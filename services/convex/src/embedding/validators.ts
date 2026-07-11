import { v } from "convex/values";

export const vEmbeddingReason = v.union(
  v.literal("focused"),
  v.literal("important"),
  v.literal("inbox"),
  v.literal("pinned"),
  v.literal("selected"),
);

export const vEmbeddingJobStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("embedded"),
  v.literal("failed"),
);

export const vMessageEmbeddingJob = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  messageId: v.id("messages"),
  status: vEmbeddingJobStatus,
  reason: vEmbeddingReason,
  jobKey: v.string(),
  contentHash: v.string(),
  attempt: v.number(),
  nextAttemptAt: v.optional(v.number()),
  model: v.string(),
  dimensions: v.number(),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vMessageEmbedding = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  messageId: v.id("messages"),
  reason: vEmbeddingReason,
  contentHash: v.string(),
  model: v.string(),
  dimensions: v.number(),
  vector: v.array(v.float64()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
