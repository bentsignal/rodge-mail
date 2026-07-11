import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";

const SEND_NEW_MAIL = makeFunctionReference<
  "action",
  { deliveryId: Id<"notificationDeliveries"> },
  null
>("notifications/actions:sendNewMail");

export async function queueNewMailNotification(
  ctx: MutationCtx,
  args: { messageId: Id<"messages">; ownerId: string },
) {
  const existing = await ctx.db
    .query("notificationDeliveries")
    .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
    .unique();
  if (existing) return { deliveryId: existing._id, queued: false };

  const now = Date.now();
  const deliveryId = await ctx.db.insert("notificationDeliveries", {
    ownerId: args.ownerId,
    messageId: args.messageId,
    status: "queued",
    tokenCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, SEND_NEW_MAIL, { deliveryId });
  return { deliveryId, queued: true };
}

export const getDeliveryInput = internalQuery({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (delivery?.status !== "queued") return null;
    const [message, preference, tokens] = await Promise.all([
      ctx.db.get(delivery.messageId),
      ctx.db
        .query("notificationPreferences")
        .withIndex("by_owner", (q) => q.eq("ownerId", delivery.ownerId))
        .unique(),
      ctx.db
        .query("mobilePushTokens")
        .withIndex("by_owner", (q) => q.eq("ownerId", delivery.ownerId))
        .collect(),
    ]);
    if (message?.ownerId !== delivery.ownerId) return null;
    return {
      delivery,
      message,
      preference,
      tokens: tokens.filter((token) => token.enabled),
    };
  },
});

export const claimDelivery = internalMutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (delivery?.status !== "queued") return false;
    await ctx.db.patch(delivery._id, {
      status: "sending",
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const completeDelivery = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    status: v.union(
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    tokenCount: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (delivery?.status !== "sending") return false;
    await ctx.db.patch(delivery._id, {
      status: args.status,
      tokenCount: args.tokenCount,
      error: args.error?.slice(0, 500),
      updatedAt: Date.now(),
    });
    return true;
  },
});
