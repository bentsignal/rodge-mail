import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
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
import { normalizeMail, stableHash } from "./normalize";
import { pendingClassificationMetadata } from "./pending";
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
  },
  handler: async (ctx, args) => {
    return await queueClassificationForMessage(ctx, {
      ownerId: args.ownerId,
      messageId: args.messageId,
      promptVersion: args.promptVersion ?? CLASSIFICATION_PROMPT_VERSION,
      replaceManual: false,
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
    summary: v.string(),
    cleanedMarkdown: v.string(),
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
      summary: args.summary.slice(0, 280),
      cleanedMarkdown: args.cleanedMarkdown.slice(0, 24_000),
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
      updatedAt: now,
    });

    await reconcileEmbeddingSelection(ctx, message._id);
    await resolveNewMailNotification(ctx, {
      important: !args.isSpam && isImportantMessage(args.importance),
      messageId: message._id,
      ownerId: message.ownerId,
    });
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

export async function queueClassificationForMessage(
  ctx: MutationCtx,
  args: {
    ownerId: string;
    messageId: Id<"messages">;
    promptVersion: string;
    replaceManual: boolean;
  },
) {
  const [message, content, existing] = await Promise.all([
    ctx.db.get(args.messageId),
    ctx.db
      .query("messageContents")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first(),
    findClassification(ctx, args.messageId),
  ]);
  if (!message || message.ownerId !== args.ownerId) {
    throw new ConvexError("Message not found");
  }
  if (existing?.source === "manual" && !args.replaceManual) {
    return { classificationId: existing._id, queued: false };
  }

  const inputHash = stableHash(normalizeMail(message, content));
  const jobKey = `${args.promptVersion}:${message._id}:${inputHash}`;
  if (existing && isCurrentClassification(existing, jobKey)) {
    return { classificationId: existing._id, queued: false };
  }

  const now = Date.now();
  const metadata = pendingClassificationMetadata(existing, message.snippet);
  const values = {
    status: "pending" as const,
    ...metadata,
    source: "rules" as const,
    promptVersion: args.promptVersion,
    outputSchemaVersion: CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
    jobKey,
    inputHash,
    attempt: 0,
    nextAttemptAt: undefined,
    signals: undefined,
    model: undefined,
    error: undefined,
    recoveryAttemptedAt: undefined,
    classifiedAt: undefined,
    updatedAt: now,
  };
  const classificationId = existing
    ? existing._id
    : await ctx.db.insert("messageClassifications", {
        ownerId: args.ownerId,
        messageId: args.messageId,
        ...values,
        createdAt: now,
      });
  if (existing) await ctx.db.patch(existing._id, values);
  await reconcileEmbeddingSelection(ctx, message._id);
  await ctx.scheduler.runAfter(0, RUN_CLASSIFICATION, {
    messageId: args.messageId,
    jobKey,
  });
  return { classificationId, queued: true };
}

function isCurrentClassification(
  classification: NonNullable<Awaited<ReturnType<typeof findClassification>>>,
  jobKey: string,
) {
  return classification.jobKey === jobKey && classification.status !== "failed";
}

async function findClassification(
  ctx: Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">,
  messageId: Id<"messages">,
) {
  return await ctx.db
    .query("messageClassifications")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .first();
}
