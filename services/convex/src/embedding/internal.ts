import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { EmbeddingReason } from "../classification/constants";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  EMBEDDING_DIMENSIONS,
  MAX_JOB_ATTEMPTS,
} from "../classification/constants";
import {
  embeddingText,
  normalizeMail,
  stableHash,
} from "../classification/normalize";
import { configuredEmbeddingModel } from "../classification/openai";
import { rateLimiter } from "../limiter";
import { isEmbeddingInputStale, isEmbeddingJobRunnable } from "./stale";
import {
  deleteEmbeddingRecords,
  embeddingSelectionPlan,
  findEmbeddingJob,
  findMessageEmbedding,
  preferredReason,
} from "./storage";
import { vEmbeddingReason } from "./validators";

interface EmbeddingActionArgs extends Record<string, unknown> {
  messageId: Id<"messages">;
  jobKey: string;
}

const RUN_EMBEDDING = makeFunctionReference<
  "action",
  EmbeddingActionArgs,
  null
>("embedding/actions:runEmbedding");

export const queue = internalMutation({
  args: {
    ownerId: v.string(),
    messageId: v.id("messages"),
    reason: vEmbeddingReason,
  },
  handler: async (ctx, args) => {
    return await queueEmbeddingForMessage(ctx, args);
  },
});

export const getJobInput = internalQuery({
  args: { messageId: v.id("messages"), jobKey: v.string() },
  handler: async (ctx, args) => {
    const [message, content, job] = await Promise.all([
      ctx.db.get(args.messageId),
      ctx.db
        .query("messageContents")
        .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
        .first(),
      findEmbeddingJob(ctx, args.messageId),
    ]);
    if (!message || job?.jobKey !== args.jobKey) return null;
    return { message, content, job };
  },
});

export const beginAttempt = internalMutation({
  args: { messageId: v.id("messages"), jobKey: v.string() },
  handler: async (ctx, args) => {
    const job = await findEmbeddingJob(ctx, args.messageId);
    if (!job || !isEmbeddingJobRunnable(job, args.jobKey)) {
      return { ready: false };
    }
    if (await isEmbeddingInputStale(ctx, job)) {
      await queueEmbeddingForMessage(ctx, {
        ownerId: job.ownerId,
        messageId: job.messageId,
        reason: job.reason,
      });
      return { ready: false };
    }

    const limited = await rateLimiter.limit(ctx, "embedMessage", {
      key: job.ownerId,
    });
    if (!limited.ok) {
      await ctx.scheduler.runAfter(limited.retryAfter, RUN_EMBEDDING, args);
      return { ready: false };
    }

    await ctx.db.patch(job._id, {
      status: "running",
      attempt: job.attempt + 1,
      nextAttemptAt: undefined,
      updatedAt: Date.now(),
    });
    return { ready: true };
  },
});

export const complete = internalMutation({
  args: {
    messageId: v.id("messages"),
    jobKey: v.string(),
    vector: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const job = await findEmbeddingJob(ctx, args.messageId);
    if (job?.jobKey !== args.jobKey) return false;
    if (args.vector.length !== EMBEDDING_DIMENSIONS) {
      throw new ConvexError(`Embedding needs ${EMBEDDING_DIMENSIONS} values`);
    }
    const existing = await findMessageEmbedding(ctx, args.messageId);
    const now = Date.now();
    const values = {
      ownerId: job.ownerId,
      accountId: job.accountId,
      messageId: job.messageId,
      reason: job.reason,
      contentHash: job.contentHash,
      model: job.model,
      dimensions: job.dimensions,
      vector: args.vector,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
    } else {
      await ctx.db.insert("messageEmbeddings", { ...values, createdAt: now });
    }
    await ctx.db.patch(job._id, {
      status: "embedded",
      error: undefined,
      nextAttemptAt: undefined,
      updatedAt: now,
    });
    return true;
  },
});

export const recordFailure = internalMutation({
  args: {
    messageId: v.id("messages"),
    jobKey: v.string(),
    error: v.string(),
    forceTerminal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const job = await findEmbeddingJob(ctx, args.messageId);
    if (job?.jobKey !== args.jobKey) return;
    const terminal = args.forceTerminal || job.attempt >= MAX_JOB_ATTEMPTS;
    const delay = job.attempt <= 1 ? 5_000 : 30_000;
    await ctx.db.patch(job._id, {
      status: terminal ? "failed" : "pending",
      error: args.error.slice(0, 500),
      nextAttemptAt: terminal ? undefined : Date.now() + delay,
      updatedAt: Date.now(),
    });
    if (!terminal) {
      await ctx.scheduler.runAfter(delay, RUN_EMBEDDING, {
        messageId: args.messageId,
        jobKey: args.jobKey,
      });
    }
  },
});

export async function queueEmbeddingForMessage(
  ctx: MutationCtx,
  args: {
    ownerId: string;
    messageId: Id<"messages">;
    reason: EmbeddingReason;
  },
) {
  const [message, content, job, existing] = await Promise.all([
    ctx.db.get(args.messageId),
    ctx.db
      .query("messageContents")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first(),
    findEmbeddingJob(ctx, args.messageId),
    findMessageEmbedding(ctx, args.messageId),
  ]);
  if (!message || message.ownerId !== args.ownerId) {
    throw new ConvexError("Message not found");
  }
  const text = embeddingText(normalizeMail(message, content));
  const contentHash = stableHash(text);
  const model = configuredEmbeddingModel();
  const jobKey = `embedding-v1:${message._id}:${contentHash}:${model}`;
  const reason = preferredReason(args.reason, existing?.reason, job?.reason);

  if (
    await reuseEmbedding(ctx, { existing, job, contentHash, model, reason })
  ) {
    return { queued: false };
  }
  if (await reuseJob(ctx, { job, jobKey, reason })) return { queued: false };

  const now = Date.now();
  const values = {
    ownerId: args.ownerId,
    accountId: message.accountId,
    messageId: message._id,
    status: "pending" as const,
    reason,
    jobKey,
    contentHash,
    attempt: 0,
    nextAttemptAt: undefined,
    model,
    dimensions: EMBEDDING_DIMENSIONS,
    error: undefined,
    updatedAt: now,
  };
  if (job) {
    await ctx.db.patch(job._id, values);
  } else {
    await ctx.db.insert("messageEmbeddingJobs", { ...values, createdAt: now });
  }
  await ctx.scheduler.runAfter(0, RUN_EMBEDDING, {
    messageId: message._id,
    jobKey,
  });
  return { queued: true };
}

export async function reconcileEmbeddingSelection(
  ctx: MutationCtx,
  messageId: Id<"messages">,
  clearSelected = false,
) {
  const [message, classification, job, embedding] = await Promise.all([
    ctx.db.get(messageId),
    ctx.db
      .query("messageClassifications")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .first(),
    findEmbeddingJob(ctx, messageId),
    findMessageEmbedding(ctx, messageId),
  ]);
  if (!message) return;
  const plan = embeddingSelectionPlan({
    clearSelected,
    inInbox: message.inInbox,
    isPinned: message.isPinned,
    bucket: classification?.bucket,
    jobReason: job?.reason,
    embeddingReason: embedding?.reason,
  });
  if (plan.preserveSelected) {
    await queueEmbeddingForMessage(ctx, {
      ownerId: message.ownerId,
      messageId,
      reason: "selected",
    });
    return;
  }
  if (plan.deleteReason) {
    await deleteEmbeddingRecords(ctx, messageId, plan.deleteReason);
  }
  if (plan.reason) {
    await queueEmbeddingForMessage(ctx, {
      ownerId: message.ownerId,
      messageId,
      reason: plan.reason,
    });
  }
}

async function reuseEmbedding(
  ctx: MutationCtx,
  args: {
    existing: Awaited<ReturnType<typeof findMessageEmbedding>>;
    job: Awaited<ReturnType<typeof findEmbeddingJob>>;
    contentHash: string;
    model: string;
    reason: EmbeddingReason;
  },
) {
  const { existing, job, contentHash, model, reason } = args;
  if (existing?.contentHash !== contentHash || existing.model !== model)
    return false;
  if (existing.reason !== reason) {
    await ctx.db.patch(existing._id, { reason, updatedAt: Date.now() });
  }
  if (job && job.reason !== reason) {
    await ctx.db.patch(job._id, { reason, updatedAt: Date.now() });
  }
  return true;
}

async function reuseJob(
  ctx: MutationCtx,
  args: {
    job: Awaited<ReturnType<typeof findEmbeddingJob>>;
    jobKey: string;
    reason: EmbeddingReason;
  },
) {
  const { job, jobKey, reason } = args;
  if (job?.jobKey !== jobKey) return false;
  if (job.status !== "pending" && job.status !== "running") return false;
  if (job.reason !== reason) {
    await ctx.db.patch(job._id, { reason, updatedAt: Date.now() });
  }
  return true;
}

export async function removeFocusedEmbedding(
  ctx: MutationCtx,
  messageId: Id<"messages">,
) {
  await deleteEmbeddingRecords(ctx, messageId, "focused");
}
