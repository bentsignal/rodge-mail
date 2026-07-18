import { v } from "convex/values";

export const vAiUsageKind = v.union(
  v.literal("classification"),
  v.literal("clean_view"),
  v.literal("embedding"),
);

export const vAiUsageStatus = v.union(
  v.literal("reserved"),
  v.literal("complete"),
  v.literal("released"),
);

export const vAiUsage = v.object({
  ownerId: v.string(),
  requestKey: v.string(),
  kind: vAiUsageKind,
  model: v.string(),
  status: vAiUsageStatus,
  costUsd: v.number(),
  reservedCostUsd: v.number(),
  inputTokens: v.optional(v.number()),
  cachedInputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
