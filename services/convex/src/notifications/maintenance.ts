import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { EXPO_RECEIPT_DELAY_MS } from "./expo";
import {
  NOTIFICATION_SEND_LEASE_MS,
  resolveStaleSendingDelivery,
} from "./recovery";

const RECOVERY_LIMIT = 50;
const CHECK_RECEIPTS = makeFunctionReference<
  "action",
  { deliveryId: Id<"notificationDeliveries"> },
  null
>("notifications/actions:checkReceipts");

export const recoverStaleDeliveries = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = clampInteger(args.limit ?? RECOVERY_LIMIT, 1, RECOVERY_LIMIT);
    const deliveries = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status_updated", (q) =>
        q
          .eq("status", "sending")
          .lt("updatedAt", now - NOTIFICATION_SEND_LEASE_MS),
      )
      .take(limit);

    let finalized = 0;
    let receiptChecks = 0;
    for (const delivery of deliveries) {
      const tickets = await ctx.db
        .query("notificationPushTickets")
        .withIndex("by_delivery", (q) => q.eq("deliveryId", delivery._id))
        .collect();
      const recovery = resolveStaleSendingDelivery(tickets);
      await ctx.db.patch(delivery._id, {
        ...recovery.patch,
        tokenCount: tickets.length || delivery.tokenCount,
        updatedAt: now,
      });
      finalized += 1;
      if (recovery.shouldCheckReceipts) {
        await ctx.scheduler.runAfter(EXPO_RECEIPT_DELAY_MS, CHECK_RECEIPTS, {
          deliveryId: delivery._id,
        });
        receiptChecks += 1;
      }
    }

    return { finalized, receiptChecks };
  },
});

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}
