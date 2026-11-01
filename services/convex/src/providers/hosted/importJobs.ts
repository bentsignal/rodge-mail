import { v } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { internalMutation, internalQuery } from "../../_generated/server";
import { env } from "../../convex.env";
import { normalizeHostedAddress } from "./addresses";
import { vMailImportFailure } from "./validators";

const IMPORT_SOURCE_PROVIDERS = ["microsoft"];
const STALE_RUN_MS = 15 * 60 * 1000;
const MAX_RECENT_FAILURES = 100;
const MAX_CONSECUTIVE_ERRORS = 5;
const RETRY_BASE_MS = 30_000;
const MAX_RETRY_MS = 30 * 60 * 1000;
// Keeps inbox classification at about half of its 60-per-minute budget.
const INBOX_MESSAGE_SPACING_MS = 2_000;

export const start = internalMutation({
  args: { source: v.string(), target: v.string() },
  handler: async (ctx, args) => {
    const ownerId = env.AUTH_ALLOWED_USER_ID;
    const target = await findHostedAccount(ctx, ownerId, args.target);
    const source = await findSourceAccount(ctx, ownerId, args.source);
    const now = Date.now();
    const runId = String(now);
    const existing = await ctx.db
      .query("mailImports")
      .withIndex("by_source_target", (q) =>
        q.eq("sourceAccountId", source._id).eq("targetAccountId", target._id),
      )
      .unique();
    if (
      existing?.status === "running" &&
      existing.updatedAt > now - STALE_RUN_MS
    ) {
      return { importId: existing._id, started: false, resumed: false };
    }
    const resumed = existing !== null && existing.status !== "completed";
    const restart = {
      status: "running" as const,
      runId,
      consecutiveErrors: 0,
      lastError: undefined,
      finishedAt: undefined,
      updatedAt: now,
    };
    const fresh = {
      cursor: undefined,
      currentFolder: undefined,
      estimatedTotal: undefined,
      imported: 0,
      skipped: 0,
      failed: 0,
      recentFailures: [],
      startedAt: now,
    };
    let importId: Id<"mailImports">;
    if (!existing) {
      importId = await ctx.db.insert("mailImports", {
        ownerId,
        sourceAccountId: source._id,
        targetAccountId: target._id,
        ...fresh,
        ...restart,
      });
    } else {
      importId = existing._id;
      await ctx.db.patch(
        importId,
        resumed ? restart : { ...fresh, ...restart },
      );
    }
    await ctx.scheduler.runAfter(0, internal.providers.hosted.importer.run, {
      importId,
      runId,
    });
    return { importId, started: true, resumed };
  },
});

export const status = internalQuery({
  args: { target: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const ownerId = env.AUTH_ALLOWED_USER_ID;
    const target = args.target
      ? normalizeHostedAddress(args.target).address
      : undefined;
    const imports = await ctx.db
      .query("mailImports")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const rows = await Promise.all(
      imports.map(async (job) => {
        const [source, targetAccount] = await Promise.all([
          ctx.db.get(job.sourceAccountId),
          ctx.db.get(job.targetAccountId),
        ]);
        return {
          importId: job._id,
          source: `${source?.provider ?? "removed"} ${source?.address ?? job.sourceAccountId}`,
          target: targetAccount?.address ?? job.targetAccountId,
          status: job.status,
          imported: job.imported,
          skipped: job.skipped,
          failed: job.failed,
          estimatedTotal: job.estimatedTotal,
          currentFolder: job.currentFolder,
          lastError: job.lastError,
          startedAt: new Date(job.startedAt).toISOString(),
          updatedAt: new Date(job.updatedAt).toISOString(),
          finishedAt: job.finishedAt
            ? new Date(job.finishedAt).toISOString()
            : undefined,
          recentFailures: job.recentFailures.slice(-20),
        };
      }),
    );
    return rows.filter((row) => !target || row.target === target);
  },
});

export const getRunContext = internalQuery({
  args: { importId: v.id("mailImports"), runId: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.importId);
    if (job?.status !== "running" || job.runId !== args.runId) return null;
    const [source, target, credential] = await Promise.all([
      ctx.db.get(job.sourceAccountId),
      ctx.db.get(job.targetAccountId),
      ctx.db
        .query("providerCredentials")
        .withIndex("by_account", (q) => q.eq("accountId", job.sourceAccountId))
        .unique(),
    ]);
    if (!source || target?.provider !== "hosted") return null;
    return {
      job,
      source,
      target,
      encryptedTokens: credential?.encryptedTokens,
    };
  },
});

export const finishBatch = internalMutation({
  args: {
    importId: v.id("mailImports"),
    runId: v.string(),
    nextCursor: v.optional(v.union(v.string(), v.null())),
    estimatedTotal: v.optional(v.number()),
    currentFolder: v.optional(v.string()),
    imported: v.number(),
    skipped: v.number(),
    inboxImported: v.number(),
    failures: v.array(vMailImportFailure),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.importId);
    if (job?.status !== "running" || job.runId !== args.runId) return;
    const now = Date.now();
    const progress = {
      imported: job.imported + args.imported,
      skipped: job.skipped + args.skipped,
      failed: job.failed + args.failures.length,
      recentFailures: [...job.recentFailures, ...args.failures].slice(
        -MAX_RECENT_FAILURES,
      ),
      estimatedTotal: args.estimatedTotal ?? job.estimatedTotal,
      currentFolder: args.currentFolder ?? job.currentFolder,
      updatedAt: now,
    };
    const next = { importId: args.importId, runId: args.runId };
    if (args.error !== undefined || args.nextCursor === undefined) {
      await recordBatchError(ctx, job, {
        progress,
        error: args.error ?? "The batch ended without a cursor",
      });
      return;
    }
    if (args.nextCursor === null) {
      await ctx.db.patch(job._id, {
        ...progress,
        cursor: undefined,
        consecutiveErrors: 0,
        lastError: undefined,
        status: "completed",
        finishedAt: now,
      });
      return;
    }
    await ctx.db.patch(job._id, {
      ...progress,
      cursor: args.nextCursor,
      consecutiveErrors: 0,
      lastError: undefined,
    });
    await ctx.scheduler.runAfter(
      args.inboxImported * INBOX_MESSAGE_SPACING_MS,
      internal.providers.hosted.importer.run,
      next,
    );
  },
});

async function recordBatchError(
  ctx: MutationCtx,
  job: Doc<"mailImports">,
  args: { progress: Partial<Doc<"mailImports">>; error: string },
) {
  const consecutiveErrors = job.consecutiveErrors + 1;
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    await ctx.db.patch(job._id, {
      ...args.progress,
      status: "failed",
      consecutiveErrors,
      lastError: args.error,
      finishedAt: Date.now(),
    });
    return;
  }
  await ctx.db.patch(job._id, {
    ...args.progress,
    consecutiveErrors,
    lastError: args.error,
  });
  await ctx.scheduler.runAfter(
    Math.min(RETRY_BASE_MS * 2 ** (consecutiveErrors - 1), MAX_RETRY_MS),
    internal.providers.hosted.importer.run,
    { importId: job._id, runId: job.runId },
  );
}

async function findHostedAccount(
  ctx: MutationCtx,
  ownerId: string,
  value: string,
) {
  const address = normalizeHostedAddress(value).address;
  const hostedAddress = await ctx.db
    .query("hostedAddresses")
    .withIndex("by_address", (q) => q.eq("address", address))
    .unique();
  const account = hostedAddress
    ? await ctx.db.get(hostedAddress.accountId)
    : null;
  if (account?.ownerId !== ownerId || account.provider !== "hosted") {
    throw new Error(`${address} is not a hosted address`);
  }
  return account;
}

async function findSourceAccount(
  ctx: MutationCtx,
  ownerId: string,
  value: string,
) {
  const address = value.trim().toLowerCase();
  const accounts = await ctx.db
    .query("mailAccounts")
    .withIndex("by_owner_address", (q) =>
      q.eq("ownerId", ownerId).eq("address", address),
    )
    .collect();
  const sources = accounts.filter(
    (account) =>
      IMPORT_SOURCE_PROVIDERS.includes(account.provider) &&
      account.status !== "disconnected",
  );
  const source = sources.at(0);
  if (!source) {
    throw new Error(
      `${address} has no connected account to import from (supported: ${IMPORT_SOURCE_PROVIDERS.join(", ")})`,
    );
  }
  if (sources.length > 1) {
    throw new Error(`${address} matches ${sources.length} source accounts`);
  }
  return source;
}
