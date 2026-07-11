import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { RECENT_BACKFILL_LIMIT, recentBackfillBounds } from "./backfill";
import { isRetryableRuleFallback } from "./retryPolicy";

const RETRY_LIMIT = 50;
const RETRY_STAGGER_MS = 2_000;

interface ClassificationActionArgs extends Record<string, unknown> {
  messageId: Id<"messages">;
  jobKey: string;
}

const RUN_CLASSIFICATION = makeFunctionReference<
  "action",
  ClassificationActionArgs,
  null
>("classification/actions:runClassification");

export const retryRecentRuleFallbacks = internalMutation({
  args: { ownerId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const bounds = recentBackfillBounds(now);
    const limit = Math.max(
      1,
      Math.min(RETRY_LIMIT, Math.floor(args.limit ?? 50)),
    );
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_owner_inbox_received", (q) =>
        q
          .eq("ownerId", args.ownerId)
          .eq("inInbox", true)
          .gte("receivedAt", bounds.cutoff)
          .lte("receivedAt", bounds.upperBound),
      )
      .order("desc")
      .take(RECENT_BACKFILL_LIMIT);
    let retried = 0;
    for (const message of messages) {
      if (retried >= limit) break;
      const classification = await ctx.db
        .query("messageClassifications")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .first();
      if (
        !classification ||
        !isRetryableRuleFallback(classification) ||
        !classification.jobKey
      ) {
        continue;
      }
      await ctx.db.patch(classification._id, {
        status: "pending",
        attempt: 0,
        nextAttemptAt: undefined,
        model: undefined,
        error: undefined,
        classifiedAt: undefined,
        recoveryAttemptedAt: now,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        retried * RETRY_STAGGER_MS,
        RUN_CLASSIFICATION,
        { messageId: classification.messageId, jobKey: classification.jobKey },
      );
      retried += 1;
    }
    return { limit, retried, staggerMs: RETRY_STAGGER_MS };
  },
});
