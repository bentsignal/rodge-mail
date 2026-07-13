import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { shouldAutoGenerateCleanView } from "../cleanView/policy";
import { queueCleanViewForMessage } from "../cleanView/queue";
import { reconcileEmbeddingSelection } from "../embedding/internal";
import { rateLimiter } from "../limiter";
import {
  vClassificationCategory,
  vClassificationSignal,
  vClassificationSource,
} from "../mail/validators";
import { resolveNewMailNotification } from "../notifications/internal";
import {
  CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
  CLASSIFICATION_PROMPT_VERSION,
  MAX_JOB_ATTEMPTS,
} from "./constants";
import { isImportantMessage } from "./importance";
import {
  assertProbability,
  canCompleteClassification,
  canRecordClassificationFailure,
  classificationRetryDelay,
  isClassificationRunnable,
} from "./jobHelpers";
import { findClassification, queueClassificationForMessage } from "./queue";
import { isClassificationInputStale } from "./stale";

interface ClassificationActionArgs extends Record<string, unknown> {
  messageId: Id<"messages">;
  jobKey: string;
}

const RUN_CLASSIFICATION = makeFunctionReference<
  "action",
  ClassificationActionArgs,
  null
>("classification/actions:runClassification");

export const listPending = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messageClassifications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(Math.max(1, Math.min(100, Math.floor(args.limit))));
  },
});

export const queue = internalMutation({
  args: {
    ownerId: v.string(),
    messageId: v.id("messages"),
    promptVersion: v.optional(v.string()),
    generateCleanView: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await queueClassificationForMessage(ctx, {
      ownerId: args.ownerId,
      messageId: args.messageId,
      promptVersion: args.promptVersion ?? CLASSIFICATION_PROMPT_VERSION,
      replaceManual: false,
      generateCleanView: args.generateCleanView,
    });
  },
});

export const getJobInput = internalQuery({
  args: { messageId: v.id("messages"), jobKey: v.string() },
  handler: async (ctx, args) => {
    const [message, classification, content] = await Promise.all([
      ctx.db.get(args.messageId),
      findClassification(ctx, args.messageId),
      ctx.db
        .query("messageContents")
        .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
        .first(),
    ]);
    if (!message || classification?.jobKey !== args.jobKey) return null;
    if (classification.source === "manual") return null;
    return { message, classification, content };
  },
});

export const beginAttempt = internalMutation({
  args: { messageId: v.id("messages"), jobKey: v.string() },
  handler: async (ctx, args) => {
    const classification = await findClassification(ctx, args.messageId);
    if (
      !classification ||
      !isClassificationRunnable(classification, args.jobKey)
    ) {
      return { ready: false };
    }
    if (await isClassificationInputStale(ctx, classification)) {
      await queueClassificationForMessage(ctx, {
        ownerId: classification.ownerId,
        messageId: classification.messageId,
        promptVersion: classification.promptVersion,
        replaceManual: false,
      });
      return { ready: false };
    }

    const limited = await rateLimiter.limit(ctx, "classifyMessage", {
      key: classification.ownerId,
    });
    if (!limited.ok) {
      await ctx.scheduler.runAfter(
        limited.retryAfter,
        RUN_CLASSIFICATION,
        args,
      );
      return { ready: false };
    }

    const attempt = (classification.attempt ?? 0) + 1;
    await ctx.db.patch(classification._id, {
      status: "running",
      attempt,
      nextAttemptAt: undefined,
      updatedAt: Date.now(),
    });
    return { ready: true, attempt };
  },
});

export const complete = internalMutation({
  args: {
    messageId: v.id("messages"),
    jobKey: v.string(),
    schemaVersion: v.literal(CLASSIFICATION_OUTPUT_SCHEMA_VERSION),
    category: vClassificationCategory,
    importance: v.number(),
    confidence: v.number(),
    reason: v.string(),
    isSpam: v.boolean(),
    signals: v.array(vClassificationSignal),
    source: vClassificationSource,
    model: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertProbability(args.importance, "importance");
    assertProbability(args.confidence, "confidence");

    const [message, classification] = await Promise.all([
      ctx.db.get(args.messageId),
      findClassification(ctx, args.messageId),
    ]);
    if (
      !message ||
      !classification ||
      !canCompleteClassification(classification, args.jobKey)
    ) {
      return false;
    }

    const now = Date.now();
    await ctx.db.patch(classification._id, {
      status: "classified",
      category: args.category,
      importance: args.importance,
      confidence: args.confidence,
      reason: args.reason.slice(0, 240),
      isSpam: args.isSpam,
      shouldEmbed:
        message.inInbox && !args.isSpam && isImportantMessage(args.importance),
      signals: args.signals,
      source: args.source,
      model: args.model,
      error: args.error,
      outputSchemaVersion: CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
      classifiedAt: now,
      nextAttemptAt: undefined,
      generateCleanViewAfterClassification: undefined,
      updatedAt: now,
    });

    await reconcileEmbeddingSelection(ctx, message._id);
    await resolveNewMailNotification(ctx, {
      important: !args.isSpam && isImportantMessage(args.importance),
      messageId: message._id,
      ownerId: message.ownerId,
    });
    if (
      shouldAutoGenerateCleanView({
        requested: classification.generateCleanViewAfterClassification,
        isSpam: args.isSpam,
        source: args.source,
      })
    ) {
      await queueCleanViewForMessage(ctx, {
        ownerId: message.ownerId,
        messageId: message._id,
        regenerate: false,
      });
    }
    return true;
  },
});

export const recordFailure = internalMutation({
  args: {
    messageId: v.id("messages"),
    jobKey: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const classification = await findClassification(ctx, args.messageId);
    if (
      !classification ||
      !canRecordClassificationFailure(classification, args.jobKey)
    ) {
      return false;
    }

    const attempt = classification.attempt ?? 1;
    const terminal = attempt >= MAX_JOB_ATTEMPTS;
    const delay = classificationRetryDelay(attempt);
    await ctx.db.patch(classification._id, {
      status: terminal ? "failed" : "pending",
      error: args.error.slice(0, 500),
      nextAttemptAt: terminal ? undefined : Date.now() + delay,
      updatedAt: Date.now(),
    });
    if (!terminal) {
      await ctx.scheduler.runAfter(delay, RUN_CLASSIFICATION, {
        messageId: args.messageId,
        jobKey: args.jobKey,
      });
    }
    return terminal;
  },
});
