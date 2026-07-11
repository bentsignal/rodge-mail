import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { EmbeddingReason } from "../classification/constants";
import { EMBEDDING_DIMENSIONS } from "../classification/constants";
import {
  embeddingText,
  normalizeMail,
  stableHash,
} from "../classification/normalize";
import { configuredEmbeddingModel } from "../classification/openai";
import {
  deleteEmbeddingRecords,
  embeddingSelectionPlan,
  findEmbeddingJob,
  findMessageEmbedding,
  preferredReason,
} from "./storage";

interface EmbeddingActionArgs extends Record<string, unknown> {
  messageId: Id<"messages">;
  jobKey: string;
}

const RUN_EMBEDDING = makeFunctionReference<
  "action",
  EmbeddingActionArgs,
  null
>("embedding/actions:runEmbedding");

interface QueueEmbeddingArgs {
  ownerId: string;
  messageId: Id<"messages">;
  reason: EmbeddingReason;
}

export async function queueEmbeddingForMessage(
  ctx: MutationCtx,
  args: QueueEmbeddingArgs,
) {
  if (args.reason !== "inbox") {
    return await queueResolvedEmbedding(ctx, args, args.reason);
  }
  return await queueInboxEmbedding(ctx, args);
}

async function queueInboxEmbedding(ctx: MutationCtx, args: QueueEmbeddingArgs) {
  const [message, job, existing, classification] = await Promise.all([
    ctx.db.get(args.messageId),
    findEmbeddingJob(ctx, args.messageId),
    findMessageEmbedding(ctx, args.messageId),
    ctx.db
      .query("messageClassifications")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first(),
  ]);
  if (!message || message.ownerId !== args.ownerId) {
    throw new ConvexError("Message not found");
  }
  const plan = embeddingSelectionPlan({
    clearSelected: false,
    embeddingReason: existing?.reason,
    importance: classification?.importance,
    inInbox: message.inInbox,
    isPinned: message.isPinned,
    jobReason: job?.reason,
  });
  if (plan.preserveSelected) {
    return await queueResolvedEmbedding(ctx, args, "selected");
  }
  if (plan.deleteReason) {
    await deleteEmbeddingRecords(ctx, message._id, plan.deleteReason);
    if (!plan.reason) return { queued: false };
    return await queueResolvedEmbedding(ctx, args, plan.reason);
  }
  if (!plan.reason) return { queued: false };
  return await queueResolvedEmbedding(ctx, args, plan.reason);
}

async function queueResolvedEmbedding(
  ctx: MutationCtx,
  args: QueueEmbeddingArgs,
  requestedReason: EmbeddingReason,
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
  const reason = preferredReason(
    requestedReason,
    existing?.reason,
    job?.reason,
  );

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
  if (job) await ctx.db.patch(job._id, values);
  else {
    await ctx.db.insert("messageEmbeddingJobs", { ...values, createdAt: now });
  }
  await ctx.scheduler.runAfter(0, RUN_EMBEDDING, {
    messageId: message._id,
    jobKey,
  });
  return { queued: true };
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
