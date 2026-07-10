import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  ensureOwnedMessage,
  getClassificationForMessage,
} from "../mail/helpers";
import { authedQuery } from "../utils";

export const getForMessage = authedQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    await ensureOwnedMessage(ctx, ctx.ownerId, args.messageId);
    return await getClassificationForMessage(ctx, args.messageId);
  },
});

export const getEmbeddingStatus = authedQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    await ensureOwnedMessage(ctx, ctx.ownerId, args.messageId);
    const [job, embedding] = await Promise.all([
      getEmbeddingJob(ctx, args.messageId),
      getEmbedding(ctx, args.messageId),
    ]);
    return embeddingStatus(job, embedding);
  },
});

function embeddingStatus(
  job: Awaited<ReturnType<typeof getEmbeddingJob>>,
  embedding: Awaited<ReturnType<typeof getEmbedding>>,
) {
  if (embedding) {
    return {
      status: "embedded",
      reason: embedding.reason,
      model: embedding.model,
      error: job?.error,
      updatedAt: embedding.updatedAt,
    };
  }
  if (job) {
    return {
      status: job.status,
      reason: job.reason,
      model: job.model,
      error: job.error,
      updatedAt: job.updatedAt,
    };
  }
  return { status: "not_selected" };
}

async function getEmbeddingJob(
  ctx: Pick<QueryCtx, "db">,
  messageId: Id<"messages">,
) {
  return await ctx.db
    .query("messageEmbeddingJobs")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .first();
}

async function getEmbedding(
  ctx: Pick<QueryCtx, "db">,
  messageId: Id<"messages">,
) {
  return await ctx.db
    .query("messageEmbeddings")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .first();
}
