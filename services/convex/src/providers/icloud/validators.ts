import { v } from "convex/values";

import { vSyncReason } from "../../mail/validators";

export const vProviderBridgeChallenge = v.object({
  ownerId: v.string(),
  challengeHash: v.string(),
  returnPath: v.string(),
  expiresAt: v.number(),
  usedAt: v.optional(v.number()),
  createdAt: v.number(),
});

export const vProviderBridgeConnection = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  provider: v.literal("icloud"),
  bridgeAccountId: v.string(),
  protocolVersion: v.literal(1),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vProviderBridgeJobKind = v.union(
  v.literal("sync"),
  v.literal("send"),
);

export const vProviderBridgeJobStatus = v.union(
  v.literal("queued"),
  v.literal("leased"),
  v.literal("succeeded"),
  v.literal("failed"),
);

export const vProviderBridgeJob = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  bridgeAccountId: v.string(),
  kind: vProviderBridgeJobKind,
  status: vProviderBridgeJobStatus,
  reason: v.optional(vSyncReason),
  outboxId: v.optional(v.id("outboxMessages")),
  syncRunId: v.optional(v.id("syncRuns")),
  attempt: v.number(),
  availableAt: v.number(),
  leaseId: v.optional(v.string()),
  leaseExpiresAt: v.optional(v.number()),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vProviderBridgeRequest = v.object({
  requestId: v.string(),
  createdAt: v.number(),
  expiresAt: v.number(),
});
