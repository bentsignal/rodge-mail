/* eslint-disable complexity, max-lines -- Bridge job leasing and account reconciliation are kept transactional. */
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { internalMutation, internalQuery } from "../../_generated/server";
import { vSyncReason } from "../../mail/validators";

const JOB_LEASE_MS = 10 * 60 * 1_000;
const REQUEST_REPLAY_WINDOW_MS = 10 * 60 * 1_000;

export const storeConnectionChallenge = internalMutation({
  args: {
    ownerId: v.string(),
    challengeHash: v.string(),
    returnPath: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const previous = await ctx.db
      .query("providerBridgeChallenges")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    for (const challenge of previous) {
      if (!challenge.usedAt) await ctx.db.delete(challenge._id);
    }
    return await ctx.db.insert("providerBridgeChallenges", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const completeConnection = internalMutation({
  args: {
    ownerId: v.string(),
    challengeHash: v.string(),
    bridgeAccountId: v.string(),
    address: v.string(),
    displayName: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db
      .query("providerBridgeChallenges")
      .withIndex("by_challenge_hash", (q) =>
        q.eq("challengeHash", args.challengeHash),
      )
      .unique();
    if (
      !challenge ||
      challenge.ownerId !== args.ownerId ||
      challenge.expiresAt < args.now
    ) {
      throw new ConvexError(
        "iCloud connection challenge is invalid or expired",
      );
    }

    const existingConnection = await ctx.db
      .query("providerBridgeConnections")
      .withIndex("by_bridge_account", (q) =>
        q.eq("bridgeAccountId", args.bridgeAccountId),
      )
      .unique();
    if (challenge.usedAt) {
      if (existingConnection?.ownerId !== args.ownerId) {
        throw new ConvexError("iCloud connection challenge was already used");
      }
      return {
        accountId: existingConnection.accountId,
        returnPath: challenge.returnPath,
      };
    }

    let account = await ctx.db
      .query("mailAccounts")
      .withIndex("by_owner_provider_remote", (q) =>
        q
          .eq("ownerId", args.ownerId)
          .eq("provider", "icloud")
          .eq("remoteAccountId", args.bridgeAccountId),
      )
      .unique();
    if (account) {
      await ctx.db.patch(account._id, {
        address: args.address,
        displayName: args.displayName,
        lastSyncError: undefined,
        status: "syncing",
        updatedAt: args.now,
      });
      account = await ctx.db.get(account._id);
    } else {
      const accountId = await ctx.db.insert("mailAccounts", {
        ownerId: args.ownerId,
        provider: "icloud",
        remoteAccountId: args.bridgeAccountId,
        address: args.address,
        displayName: args.displayName,
        status: "syncing",
        grantedScopes: ["imap", "smtp"],
        connectedAt: args.now,
        createdAt: args.now,
        updatedAt: args.now,
      });
      account = await ctx.db.get(accountId);
    }
    if (!account) throw new ConvexError("Unable to create iCloud account");

    if (existingConnection) {
      await ctx.db.patch(existingConnection._id, { updatedAt: args.now });
    } else {
      await ctx.db.insert("providerBridgeConnections", {
        ownerId: args.ownerId,
        accountId: account._id,
        provider: "icloud",
        bridgeAccountId: args.bridgeAccountId,
        protocolVersion: 1,
        createdAt: args.now,
        updatedAt: args.now,
      });
    }
    await ctx.db.patch(challenge._id, { usedAt: args.now });
    await insertSyncJob(ctx, {
      ownerId: args.ownerId,
      accountId: account._id,
      bridgeAccountId: args.bridgeAccountId,
      reason: "initial",
      now: args.now,
    });
    return { accountId: account._id, returnPath: challenge.returnPath };
  },
});

export const consumeRequestId = internalMutation({
  args: { requestId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("providerBridgeRequests")
      .withIndex("by_request_id", (q) => q.eq("requestId", args.requestId))
      .unique();
    if (existing) return false;
    await ctx.db.insert("providerBridgeRequests", {
      requestId: args.requestId,
      createdAt: args.now,
      expiresAt: args.now + REQUEST_REPLAY_WINDOW_MS,
    });
    const expired = await ctx.db
      .query("providerBridgeRequests")
      .filter((q) => q.lt(q.field("expiresAt"), args.now))
      .take(100);
    for (const request of expired) await ctx.db.delete(request._id);
    return true;
  },
});

export const enqueueSyncJob = internalMutation({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    reason: vSyncReason,
  },
  handler: async (ctx, args) => {
    const connection = await ownedConnection(ctx, args.ownerId, args.accountId);
    return await insertSyncJob(ctx, {
      ...args,
      bridgeAccountId: connection.bridgeAccountId,
      now: Date.now(),
    });
  },
});

export const enqueueSendJob = internalMutation({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    outboxId: v.id("outboxMessages"),
  },
  handler: async (ctx, args) => {
    const connection = await ownedConnection(ctx, args.ownerId, args.accountId);
    const existing = await ctx.db
      .query("providerBridgeJobs")
      .withIndex("by_outbox", (q) => q.eq("outboxId", args.outboxId))
      .filter((q) => q.neq(q.field("status"), "succeeded"))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "queued",
        availableAt: now,
        leaseId: undefined,
        leaseExpiresAt: undefined,
        error: undefined,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("providerBridgeJobs", {
      ownerId: args.ownerId,
      accountId: args.accountId,
      bridgeAccountId: connection.bridgeAccountId,
      kind: "send",
      status: "queued",
      outboxId: args.outboxId,
      attempt: 0,
      availableAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const claimJobs = internalMutation({
  args: { bridgeAccountId: v.string(), maxJobs: v.number(), now: v.number() },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("providerBridgeConnections")
      .withIndex("by_bridge_account", (q) =>
        q.eq("bridgeAccountId", args.bridgeAccountId),
      )
      .unique();
    if (!connection) throw new ConvexError("Unknown iCloud bridge account");

    const [queued, leased] = await Promise.all([
      ctx.db
        .query("providerBridgeJobs")
        .withIndex("by_bridge_status_available", (q) =>
          q
            .eq("bridgeAccountId", args.bridgeAccountId)
            .eq("status", "queued")
            .lte("availableAt", args.now),
        )
        .take(args.maxJobs),
      ctx.db
        .query("providerBridgeJobs")
        .withIndex("by_bridge_status_available", (q) =>
          q.eq("bridgeAccountId", args.bridgeAccountId).eq("status", "leased"),
        )
        .filter((q) => q.lt(q.field("leaseExpiresAt"), args.now))
        .take(args.maxJobs),
    ]);
    const selected = [...leased, ...queued].slice(0, args.maxJobs);
    const jobs = [];
    for (const job of selected) {
      const claimed = await claimJob(ctx, job, args.now);
      if (claimed) jobs.push(claimed);
    }
    return { jobs };
  },
});

export const getSyncIngestionContext = internalQuery({
  args: {
    bridgeAccountId: v.string(),
    jobId: v.id("providerBridgeJobs"),
    leaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (
      !job ||
      job.bridgeAccountId !== args.bridgeAccountId ||
      job.kind !== "sync" ||
      job.status !== "leased" ||
      job.leaseId !== args.leaseId
    ) {
      return null;
    }
    return { ownerId: job.ownerId, accountId: job.accountId };
  },
});

export const finishSyncJob = internalMutation({
  args: {
    bridgeAccountId: v.string(),
    jobId: v.id("providerBridgeJobs"),
    leaseId: v.string(),
    cursor: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await validLeasedJob(ctx, args, "sync");
    if (!job) return false;
    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: args.error ? "failed" : "succeeded",
      error: args.error,
      leaseId: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    });
    if (job.syncRunId) {
      await ctx.db.patch(job.syncRunId, {
        status: args.error ? "failed" : "succeeded",
        cursor: args.cursor,
        error: args.error,
        completedAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(job.accountId, {
      status: args.error
        ? args.error.startsWith("AUTHENTICATION_FAILED:")
          ? "reauthorization_required"
          : "error"
        : "connected",
      lastSyncError: args.error,
      ...(args.error ? {} : { lastSyncedAt: now, syncCursor: args.cursor }),
      updatedAt: now,
    });
    return true;
  },
});

export const finishSendJob = internalMutation({
  args: {
    bridgeAccountId: v.string(),
    jobId: v.id("providerBridgeJobs"),
    leaseId: v.string(),
    remoteMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    deliveryUnknown: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const job = await validLeasedJob(ctx, args, "send");
    if (!job?.outboxId) return false;
    const outbox = await ctx.db.get(job.outboxId);
    if (!outbox || outbox.leaseId !== args.leaseId) return false;
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(job._id, {
        status: args.error ? "failed" : "succeeded",
        error: args.error,
        leaseId: undefined,
        leaseExpiresAt: undefined,
        updatedAt: now,
      }),
      ctx.db.patch(outbox._id, {
        status: args.error ? "failed" : "sent",
        leaseId: undefined,
        error: args.deliveryUnknown
          ? `Delivery status unknown: ${args.error ?? "SMTP acknowledgement was interrupted"}`
          : args.error,
        remoteMessageId: args.remoteMessageId,
        sentAt: args.error ? undefined : now,
        updatedAt: now,
      }),
    ]);
    if (!args.error) {
      const connection = await ownedConnection(ctx, job.ownerId, job.accountId);
      await insertSyncJob(ctx, {
        ownerId: job.ownerId,
        accountId: job.accountId,
        bridgeAccountId: connection.bridgeAccountId,
        reason: "incremental",
        now,
      });
    }
    return true;
  },
});

export const scheduleConnectedAccounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.db
      .query("providerBridgeConnections")
      .collect();
    const cutoff = Date.now() - 4 * 60 * 1_000;
    for (const connection of connections) {
      const account = await ctx.db.get(connection.accountId);
      if (
        account?.provider === "icloud" &&
        !account.isDemo &&
        ["connected", "error"].includes(account.status) &&
        (account.lastSyncedAt ?? 0) < cutoff
      ) {
        await insertSyncJob(ctx, {
          ownerId: connection.ownerId,
          accountId: connection.accountId,
          bridgeAccountId: connection.bridgeAccountId,
          reason: "incremental",
          now: Date.now(),
        });
      }
    }
  },
});

async function insertSyncJob(
  ctx: MutationCtx,
  args: {
    ownerId: string;
    accountId: Id<"mailAccounts">;
    bridgeAccountId: string;
    reason: "initial" | "incremental" | "manual" | "reconcile";
    now: number;
  },
) {
  const recent = await ctx.db
    .query("providerBridgeJobs")
    .withIndex("by_account_kind_created", (q) =>
      q.eq("accountId", args.accountId).eq("kind", "sync"),
    )
    .order("desc")
    .take(10);
  const active = recent.find((job) =>
    ["queued", "leased"].includes(job.status),
  );
  if (active) return active._id;
  return await ctx.db.insert("providerBridgeJobs", {
    ownerId: args.ownerId,
    accountId: args.accountId,
    bridgeAccountId: args.bridgeAccountId,
    kind: "sync",
    status: "queued",
    reason: args.reason,
    attempt: 0,
    availableAt: args.now,
    createdAt: args.now,
    updatedAt: args.now,
  });
}

async function ownedConnection(
  ctx: MutationCtx,
  ownerId: string,
  accountId: Id<"mailAccounts">,
) {
  const connection = await ctx.db
    .query("providerBridgeConnections")
    .withIndex("by_account", (q) => q.eq("accountId", accountId))
    .unique();
  if (connection?.ownerId !== ownerId) {
    throw new ConvexError("iCloud bridge connection not found");
  }
  return connection;
}

async function claimJob(
  ctx: MutationCtx,
  job: Doc<"providerBridgeJobs">,
  now: number,
) {
  const account = await ctx.db.get(job.accountId);
  if (account?.provider !== "icloud") return null;
  const leaseId = crypto.randomUUID();
  const syncRunId =
    job.kind === "sync"
      ? await ctx.db.insert("syncRuns", {
          ownerId: job.ownerId,
          accountId: job.accountId,
          reason: job.reason ?? "incremental",
          status: "running",
          cursor: account.syncCursor,
          attempt: job.attempt + 1,
          createdAt: now,
          startedAt: now,
          updatedAt: now,
        })
      : undefined;
  await ctx.db.patch(job._id, {
    status: "leased",
    attempt: job.attempt + 1,
    leaseId,
    leaseExpiresAt: now + JOB_LEASE_MS,
    syncRunId,
    error: undefined,
    updatedAt: now,
  });
  if (job.kind === "sync") {
    await ctx.db.patch(account._id, {
      status: "syncing",
      lastSyncError: undefined,
      updatedAt: now,
    });
    return {
      kind: "sync" as const,
      jobId: job._id,
      leaseId,
      cursor: account.syncCursor,
      reason: job.reason ?? "incremental",
    };
  }
  if (!job.outboxId) return null;
  const outbox = await ctx.db.get(job.outboxId);
  if (!outbox || !["pending", "failed", "sending"].includes(outbox.status)) {
    return null;
  }
  await ctx.db.patch(outbox._id, {
    status: "sending",
    attempt: outbox.attempt + 1,
    leaseId,
    error: undefined,
    updatedAt: now,
  });
  return {
    kind: "send" as const,
    jobId: job._id,
    leaseId,
    outboxId: outbox._id,
    from: account.address,
    to: outbox.to,
    cc: outbox.cc,
    bcc: outbox.bcc,
    subject: outbox.subject,
    plainText: outbox.plainText,
    replyToInternetMessageId: outbox.replyToInternetMessageId,
  };
}

async function validLeasedJob(
  ctx: MutationCtx,
  args: {
    bridgeAccountId: string;
    jobId: Id<"providerBridgeJobs">;
    leaseId: string;
  },
  kind: "sync" | "send",
) {
  const job = await ctx.db.get(args.jobId);
  if (
    !job ||
    job.bridgeAccountId !== args.bridgeAccountId ||
    job.kind !== kind ||
    job.status !== "leased" ||
    job.leaseId !== args.leaseId
  ) {
    return null;
  }
  return job;
}
