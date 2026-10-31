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
