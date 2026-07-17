import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { reconcileEmbeddingSelection } from "../embedding/internal";
import {
  nextBackfillRemaining,
  RECENT_BACKFILL_LIMIT,
  RECENT_BACKFILL_PAGE_DELAY_MS,
  RECENT_BACKFILL_PAGE_SIZE,
  recentBackfillBounds,
} from "./backfill";
import { CLASSIFICATION_PROMPT_VERSION } from "./constants";
import { requiredClassificationMetadata } from "./pending";
import { queueClassificationForMessage } from "./queue";
import { classificationRecoveryPlan } from "./stale";

const METADATA_MIGRATION_BATCH_SIZE = 200;
const RECOVERY_LIMIT = 25;
const RECOVERY_STAGGER_MS = 1_000;

interface ClassificationActionArgs extends Record<string, unknown> {
  messageId: Id<"messages">;
  jobKey: string;
}

interface ClassificationFallbackArgs extends ClassificationActionArgs {
  error: string;
}

interface RecentBackfillPageArgs extends Record<string, unknown> {
  ownerId: string;
  cursor: string | null;
  remaining: number;
  cutoff: number;
  upperBound: number;
  startedAt: number;
}

const RUN_CLASSIFICATION = makeFunctionReference<
  "action",
  ClassificationActionArgs,
  null
>("classification/actions:runClassification");

const FINALIZE_WITH_FALLBACK = makeFunctionReference<
  "action",
  ClassificationFallbackArgs,
  null
>("classification/actions:finalizeWithFallback");

const CONTINUE_RECENT_BACKFILL = makeFunctionReference<
  "mutation",
  RecentBackfillPageArgs,
  null
>("classification/maintenance:backfillRecentInboxPage");

export const migrateRequiredMetadata = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("messageClassifications").paginate({
      cursor: args.cursor,
      numItems: METADATA_MIGRATION_BATCH_SIZE,
    });
    let patched = 0;
    for (const classification of page.page) {
      const category = legacyField(classification, "category");
      const reason = legacyField(classification, "reason");
      const summary = legacyField(classification, "summary");
      if (
        category !== undefined &&
        reason !== undefined &&
        summary !== undefined
      ) {
        continue;
      }
      const message = await ctx.db.get(classification.messageId);
      await ctx.db.patch(
        classification._id,
        requiredClassificationMetadata(
          { category, reason, summary },
          message?.snippet ?? "",
        ),
      );
      patched += 1;
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      patched,
      scanned: page.page.length,
    };
  },
});

export const recoverStaleJobs = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = clampInteger(args.limit ?? RECOVERY_LIMIT, 1, RECOVERY_LIMIT);
    const candidates = (
      await Promise.all(
        (["pending", "running"] as const).map(async (status) => {
          return await ctx.db
            .query("messageClassifications")
            .withIndex("by_status", (q) => q.eq("status", status))
            .take(limit);
        }),
      )
    ).flat();

    let discarded = 0;
    let fallback = 0;
    let retried = 0;
    let handled = 0;

    for (const classification of candidates) {
      if (handled >= limit) break;
      const message = await ctx.db.get(classification.messageId);
      const plan = classificationRecoveryPlan(classification, message, now);
      if (!plan) continue;
      handled += 1;

      if (plan === "discard") {
        await ctx.db.delete(classification._id);
        await reconcileEmbeddingSelection(ctx, classification.messageId);
        discarded += 1;
        continue;
      }

      const jobKey = classification.jobKey;
      if (!jobKey) {
        await ctx.db.delete(classification._id);
        await reconcileEmbeddingSelection(ctx, classification.messageId);
        discarded += 1;
        continue;
      }

      const delay = (handled - 1) * RECOVERY_STAGGER_MS;
      if (plan === "fallback") {
        await ctx.db.patch(classification._id, {
          status: "running",
          nextAttemptAt: undefined,
          updatedAt: now,
        });
        await ctx.scheduler.runAfter(delay, FINALIZE_WITH_FALLBACK, {
          messageId: classification.messageId,
          jobKey,
          error: "Recovered an abandoned classification after maximum attempts",
        });
        fallback += 1;
        continue;
      }

      await ctx.db.patch(classification._id, {
        status: "pending",
        nextAttemptAt: undefined,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(delay, RUN_CLASSIFICATION, {
        messageId: classification.messageId,
        jobKey,
      });
      retried += 1;
    }

    return {
      discarded,
      fallback,
      retried,
      scanned: candidates.length,
    };
  },
});

export const startRecentInboxBackfill = internalMutation({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("mailAccounts")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .first();
    if (!account) throw new ConvexError("Mail owner not found");

    const startedAt = Date.now();
    const bounds = recentBackfillBounds(startedAt);
    await ctx.scheduler.runAfter(0, CONTINUE_RECENT_BACKFILL, {
      ownerId: args.ownerId,
      cursor: null,
      remaining: RECENT_BACKFILL_LIMIT,
      cutoff: bounds.cutoff,
      upperBound: bounds.upperBound,
      startedAt,
    });
    return {
      maxAgeMs: startedAt - bounds.cutoff,
      maxMessages: RECENT_BACKFILL_LIMIT,
      pageDelayMs: RECENT_BACKFILL_PAGE_DELAY_MS,
      pageSize: RECENT_BACKFILL_PAGE_SIZE,
      startedAt,
    };
  },
});

export const backfillRecentInboxPage = internalMutation({
  args: {
    ownerId: v.string(),
    cursor: v.union(v.string(), v.null()),
    remaining: v.number(),
    cutoff: v.number(),
    upperBound: v.number(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const remaining = clampInteger(args.remaining, 0, RECENT_BACKFILL_LIMIT);
    if (remaining === 0) return { done: true, queued: 0, scanned: 0 };

    const page = await ctx.db
      .query("messages")
      .withIndex("by_owner_inbox_received", (q) =>
        q
          .eq("ownerId", args.ownerId)
          .eq("inInbox", true)
          .gte("receivedAt", args.cutoff)
          .lte("receivedAt", args.upperBound),
      )
      .order("desc")
      .paginate({
        cursor: args.cursor,
        numItems: Math.min(RECENT_BACKFILL_PAGE_SIZE, remaining),
      });

    let queued = 0;
    for (const message of page.page) {
      const result = await queueClassificationForMessage(ctx, {
        ownerId: args.ownerId,
        messageId: message._id,
        promptVersion: CLASSIFICATION_PROMPT_VERSION,
        replaceManual: false,
      });
      queued += Number(result.queued);
    }

    const nextRemaining = nextBackfillRemaining(remaining, page.page.length);
    const done = page.isDone || nextRemaining === 0 || page.page.length === 0;
    if (!done) {
      await ctx.scheduler.runAfter(
        RECENT_BACKFILL_PAGE_DELAY_MS,
        CONTINUE_RECENT_BACKFILL,
        {
          ownerId: args.ownerId,
          cursor: page.continueCursor,
          remaining: nextRemaining,
          cutoff: args.cutoff,
          upperBound: args.upperBound,
          startedAt: args.startedAt,
        },
      );
    }

    return {
      continueCursor: page.continueCursor,
      done,
      queued,
      remaining: nextRemaining,
      scanned: page.page.length,
      startedAt: args.startedAt,
    };
  },
});

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}

function legacyField<T extends object, K extends keyof T>(value: T, key: K) {
  return Object.prototype.hasOwnProperty.call(value, key)
    ? value[key]
    : undefined;
}

export { RECOVERY_LIMIT };
