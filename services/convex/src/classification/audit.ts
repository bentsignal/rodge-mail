import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { internalQuery } from "../_generated/server";
import { findEmbeddingJob, findMessageEmbedding } from "../embedding/storage";
import { RECENT_BACKFILL_LIMIT, recentBackfillBounds } from "./backfill";
import {
  CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
  CLASSIFICATION_PROMPT_VERSION,
} from "./constants";
import { isImportantMessage } from "./importance";
import {
  CLASSIFICATION_RECOVERY_MAX_AGE_MS,
  classificationRecoveryPlan,
} from "./stale";

export const auditRecentInbox = internalQuery({
  args: { ownerId: v.string(), since: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const bounds = recentBackfillBounds(now);
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

    const counts = emptyAuditCounts();
    for (const message of messages) {
      await countMessage({
        ctx,
        message,
        counts,
        now,
        since: args.since ?? 0,
      });
    }
    return {
      ...counts,
      maxAgeMs: CLASSIFICATION_RECOVERY_MAX_AGE_MS,
      maxMessages: RECENT_BACKFILL_LIMIT,
      newestReceivedAt: messages[0]?.receivedAt,
      oldestReceivedAt: messages.at(-1)?.receivedAt,
      targetCount: messages.length,
    };
  },
});

async function countMessage(args: {
  ctx: QueryCtx;
  message: Doc<"messages">;
  counts: ReturnType<typeof emptyAuditCounts>;
  now: number;
  since: number;
}) {
  const { ctx, message, counts, now, since } = args;
  const [classification, embedding, job] = await Promise.all([
    ctx.db
      .query("messageClassifications")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .first(),
    findMessageEmbedding(ctx, message._id),
    findEmbeddingJob(ctx, message._id),
  ]);
  countClassification({ counts, classification, message, now, since });
  counts.embedded += Number(Boolean(embedding));
  counts.legacyEmbeddingReasons += Number(isLegacyReason(embedding?.reason));
  counts.legacyJobReasons += Number(isLegacyReason(job?.reason));
  const expectedEmbedding = expectsEmbedding({
    embeddingReason: embedding?.reason,
    importance: classification?.importance,
    isPinned: message.isPinned,
    jobReason: job?.reason,
  });
  counts.missingExpectedEmbeddings += Number(expectedEmbedding && !embedding);
  counts.unexpectedEmbeddings += Number(
    !expectedEmbedding && Boolean(embedding),
  );
}

function countClassification(args: {
  counts: ReturnType<typeof emptyAuditCounts>;
  classification: Doc<"messageClassifications"> | null;
  message: Doc<"messages">;
  now: number;
  since: number;
}) {
  const { counts, classification, message, now, since } = args;
  if (!classification) {
    counts.missing += 1;
    return;
  }
  counts[classification.status] += 1;
  counts[classification.source] += 1;
  counts.withError += Number(Boolean(classification.error));
  const currentVersion =
    classification.promptVersion === CLASSIFICATION_PROMPT_VERSION &&
    classification.outputSchemaVersion === CLASSIFICATION_OUTPUT_SCHEMA_VERSION;
  counts.currentVersion += Number(currentVersion);
  counts.modelV2Since += Number(
    currentVersion &&
      classification.source === "model" &&
      classification.model !== undefined &&
      classification.error === undefined &&
      classification.classifiedAt !== undefined &&
      classification.classifiedAt >= since,
  );
  counts.stale += Number(
    classificationRecoveryPlan(classification, message, now) !== null,
  );
  counts.important += Number(
    classification.status === "classified" &&
      isImportantMessage(classification.importance),
  );
}

function expectsEmbedding(args: {
  embeddingReason: string | undefined;
  importance: number | undefined;
  isPinned: boolean;
  jobReason: string | undefined;
}) {
  return (
    args.embeddingReason === "selected" ||
    args.jobReason === "selected" ||
    args.isPinned ||
    isImportantMessage(args.importance)
  );
}

function emptyAuditCounts() {
  return {
    classified: 0,
    failed: 0,
    manual: 0,
    missing: 0,
    model: 0,
    pending: 0,
    rules: 0,
    running: 0,
    seed: 0,
    currentVersion: 0,
    modelV2Since: 0,
    stale: 0,
    withError: 0,
    important: 0,
    embedded: 0,
    legacyEmbeddingReasons: 0,
    legacyJobReasons: 0,
    missingExpectedEmbeddings: 0,
    unexpectedEmbeddings: 0,
  };
}

function isLegacyReason(reason: string | undefined) {
  return reason === "focused" || reason === "inbox";
}
