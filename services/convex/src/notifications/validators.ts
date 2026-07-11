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

export const vNotificationDeliveryStatus = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("failed"),
  v.literal("skipped"),
);

export const vNotificationDelivery = v.object({
  ownerId: v.string(),
  messageId: v.id("messages"),
  status: vNotificationDeliveryStatus,
  tokenCount: v.number(),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
