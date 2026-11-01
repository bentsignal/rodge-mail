import { v } from "convex/values";

import { vMailboxAddress } from "../../mail/validators";

export const vHostedDomain = v.object({
  ownerId: v.string(),
  domain: v.string(),
  catchAllAccountId: v.optional(v.id("mailAccounts")),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vHostedAddress = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  address: v.string(),
  domain: v.string(),
  createdAt: v.number(),
});

export const vHostedDeliveryEventType = v.union(
  v.literal("bounce"),
  v.literal("complaint"),
  v.literal("delivery"),
  v.literal("delay"),
  v.literal("reject"),
);

export const vHostedDeliveryEvent = v.object({
  ownerId: v.optional(v.string()),
  sesMessageId: v.string(),
  type: vHostedDeliveryEventType,
  recipients: v.array(vMailboxAddress),
  detail: v.optional(v.string()),
  occurredAt: v.number(),
  createdAt: v.number(),
});

export const vMailImportStatus = v.union(
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);

export const vMailImportFailure = v.object({
  remoteMessageId: v.string(),
  folder: v.string(),
  reason: v.string(),
  at: v.number(),
  subject: v.optional(v.string()),
  from: v.optional(v.string()),
  receivedAt: v.optional(v.number()),
});

export const vMailImport = v.object({
  ownerId: v.string(),
  sourceAccountId: v.id("mailAccounts"),
  targetAccountId: v.id("mailAccounts"),
  status: vMailImportStatus,
  runId: v.string(),
  cursor: v.optional(v.string()),
  currentFolder: v.optional(v.string()),
  estimatedTotal: v.optional(v.number()),
  imported: v.number(),
  skipped: v.number(),
  failed: v.number(),
  recentFailures: v.array(vMailImportFailure),
  consecutiveErrors: v.number(),
  lastError: v.optional(v.string()),
  startedAt: v.number(),
  updatedAt: v.number(),
  finishedAt: v.optional(v.number()),
});
