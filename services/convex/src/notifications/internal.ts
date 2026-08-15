import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  archiveOwnedThread,
  setOwnedThreadPinned,
  setOwnedThreadRead,
} from "../mail/threadMutations";
import { getMailingListInfo } from "../mailingLists/policy";
import { isNotificationDeliveryFresh } from "./policy";
import { resolveNotificationPreferences } from "./preferences";
import { vNotificationQuickAction } from "./validators";

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
    status: "ready",
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
    if (delivery?.status !== "ready") return null;
    const message = await ctx.db.get(delivery.messageId);
    if (message?.ownerId !== delivery.ownerId) return null;
    const [globalPreference, accountPreference, classification, tokens] =
      await Promise.all([
        ctx.db
          .query("notificationPreferences")
          .withIndex("by_owner", (q) => q.eq("ownerId", delivery.ownerId))
          .unique(),
        ctx.db
          .query("accountNotificationPreferences")
          .withIndex("by_owner_account", (q) =>
            q
              .eq("ownerId", delivery.ownerId)
              .eq("accountId", message.accountId),
          )
          .unique(),
        ctx.db
          .query("messageClassifications")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .first(),
        ctx.db
          .query("mobilePushTokens")
          .withIndex("by_owner", (q) => q.eq("ownerId", delivery.ownerId))
          .collect(),
      ]);
    return {
      delivery,
      message,
      preference: resolveNotificationPreferences(
        globalPreference,
        accountPreference,
      ),
      unsubscribeAvailable:
        getMailingListInfo(message, classification?.category) !== undefined,
      tokens: tokens.filter((token) => token.enabled),
    };
  },
});

export const claimDelivery = internalMutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (delivery?.status !== "ready") return false;
    const message = await ctx.db.get(delivery.messageId);
    if (
      !message ||
      message.ownerId !== delivery.ownerId ||
      !isNotificationDeliveryFresh({
        deliveryCreatedAt: delivery.createdAt,
        messageReceivedAt: message.receivedAt,
        now: Date.now(),
      })
    ) {
      await ctx.db.patch(delivery._id, {
        status: "skipped",
        updatedAt: Date.now(),
      });
      return false;
    }
    await ctx.db.patch(delivery._id, {
      status: "sending",
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const setQuickActionCapability = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    expiresAt: v.number(),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (delivery?.status !== "sending") return false;
    await ctx.db.patch(delivery._id, {
      quickActionExpiresAt: args.expiresAt,
      quickActionTokenHash: args.tokenHash,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const performQuickAction = internalMutation({
  args: {
    action: vNotificationQuickAction,
    deliveryId: v.string(),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const authorization = await authorizeQuickAction(ctx, args);
    if (!authorization.delivery) return authorization.allowed;
    const { delivery } = authorization;

    const message = await ctx.db.get(delivery.messageId);
    if (!message || message.ownerId !== delivery.ownerId) return false;
    if (args.action === "pin") {
      await setOwnedThreadPinned(ctx, delivery.ownerId, message.threadId, true);
    } else if (args.action === "mark-read") {
      await setOwnedThreadRead(ctx, delivery.ownerId, message.threadId, true);
    } else {
      await archiveOwnedThread(ctx, delivery.ownerId, message.threadId);
    }
    await ctx.db.patch(delivery._id, {
      quickAction: args.action,
      quickActionAt: Date.now(),
      updatedAt: Date.now(),
    });
    return true;
  },
});

async function authorizeQuickAction(
  ctx: MutationCtx,
  args: {
    action: "archive" | "mark-read" | "pin";
    deliveryId: string;
    tokenHash: string;
  },
) {
  const deliveryId = ctx.db.normalizeId(
    "notificationDeliveries",
    args.deliveryId,
  );
  if (!deliveryId) return { allowed: false };
  const delivery = await ctx.db.get(deliveryId);
  if (
    !delivery?.quickActionTokenHash ||
    delivery.quickActionTokenHash !== args.tokenHash ||
    !delivery.quickActionExpiresAt ||
    delivery.quickActionExpiresAt < Date.now()
  ) {
    return { allowed: false };
  }
  if (delivery.quickAction) {
    return { allowed: delivery.quickAction === args.action };
  }
  return { allowed: true, delivery };
}

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
