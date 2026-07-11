import { v } from "convex/values";

export const vPushPlatform = v.union(v.literal("android"), v.literal("ios"));

export const vMobilePushToken = v.object({
  ownerId: v.string(),
  token: v.string(),
  deviceId: v.string(),
  platform: vPushPlatform,
  enabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vNotificationPreference = v.object({
  ownerId: v.string(),
  newMailEnabled: v.boolean(),
  includePreview: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vAccountNotificationPreference = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  newMailEnabled: v.optional(v.boolean()),
  includePreview: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vNotificationDeliveryStatus = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("accepted"),
  v.literal("sent"),
  v.literal("partial"),
  v.literal("failed"),
  v.literal("skipped"),
);

export const vNotificationFailureKind = v.union(
  v.literal("permanent"),
  v.literal("transient"),
);

export const vNotificationDelivery = v.object({
  ownerId: v.string(),
  messageId: v.id("messages"),
  status: vNotificationDeliveryStatus,
  tokenCount: v.number(),
  acceptedCount: v.optional(v.number()),
  deliveredCount: v.optional(v.number()),
  failedCount: v.optional(v.number()),
  failureKind: v.optional(vNotificationFailureKind),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vNotificationPushTicket = v.object({
  ownerId: v.string(),
  deliveryId: v.id("notificationDeliveries"),
  tokenId: v.id("mobilePushTokens"),
  expoTicketId: v.optional(v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("delivered"),
    v.literal("failed"),
  ),
  receiptAttempts: v.number(),
  failureKind: v.optional(vNotificationFailureKind),
  errorCode: v.optional(v.string()),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
