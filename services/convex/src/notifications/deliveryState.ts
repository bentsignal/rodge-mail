import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { resolveReceiptStatus, summarizeDeliveryTickets } from "./delivery";
import {
  EXPO_RECEIPT_BATCH_SIZE,
  EXPO_RECEIPT_DELAY_MS,
  EXPO_RECEIPT_MAX_ATTEMPTS,
  shouldDisableExpoPushToken,
} from "./expo";
import { vNotificationFailureKind } from "./validators";

const CHECK_RECEIPTS = makeFunctionReference<
  "action",
  { deliveryId: Id<"notificationDeliveries"> },
  null
>("notifications/actions:checkReceipts");

const vTicketFailure = {
  failureKind: v.optional(vNotificationFailureKind),
  errorCode: v.optional(v.string()),
  error: v.optional(v.string()),
};

interface ReceiptMutationOutcome {
  pushTicketId: Id<"notificationPushTickets">;
  status: "delivered" | "failed" | "pending";
  failureKind?: "permanent" | "transient";
  errorCode?: string;
  error?: string;
}

export const recordPushTickets = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    outcomes: v.array(
      v.object({
        tokenId: v.id("mobilePushTokens"),
        status: v.union(v.literal("accepted"), v.literal("failed")),
        ticketId: v.optional(v.string()),
        ...vTicketFailure,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (delivery?.status !== "sending") return false;
    const now = Date.now();
    await Promise.all(
      args.outcomes.map(async (outcome) => {
        if (outcome.status === "accepted" && !outcome.ticketId) {
          throw new ConvexError("Accepted Expo ticket is missing its id");
        }
        await ctx.db.insert("notificationPushTickets", {
          ownerId: delivery.ownerId,
          deliveryId: delivery._id,
          tokenId: outcome.tokenId,
          expoTicketId: outcome.ticketId,
          status: outcome.status === "accepted" ? "pending" : "failed",
          receiptAttempts: 0,
          failureKind: outcome.failureKind,
          errorCode: outcome.errorCode,
          error: outcome.error?.slice(0, 500),
          createdAt: now,
          updatedAt: now,
        });
        await disableUnregisteredToken(ctx, outcome.tokenId, outcome.errorCode);
      }),
    );
    const tickets = await getDeliveryTickets(ctx, delivery._id);
    await ctx.db.patch(delivery._id, {
      ...summarizeDeliveryTickets(tickets),
      tokenCount: args.outcomes.length,
      updatedAt: now,
    });
    if (tickets.some((ticket) => ticket.status === "pending")) {
      await ctx.scheduler.runAfter(EXPO_RECEIPT_DELAY_MS, CHECK_RECEIPTS, {
        deliveryId: delivery._id,
      });
    }
    return true;
  },
});

export const getPendingReceiptInput = internalQuery({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (delivery?.status !== "accepted" && delivery?.status !== "partial") {
      return null;
    }
    const tickets = await ctx.db
      .query("notificationPushTickets")
      .withIndex("by_delivery", (q) => q.eq("deliveryId", delivery._id))
      .collect();
    return {
      delivery,
      tickets: tickets
        .filter(
          (ticket) =>
            ticket.status === "pending" &&
            ticket.expoTicketId !== undefined &&
            ticket.receiptAttempts < EXPO_RECEIPT_MAX_ATTEMPTS,
        )
        .slice(0, EXPO_RECEIPT_BATCH_SIZE),
    };
  },
});

export const recordReceiptOutcomes = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    outcomes: v.array(
      v.object({
        pushTicketId: v.id("notificationPushTickets"),
        status: v.union(
          v.literal("delivered"),
          v.literal("failed"),
          v.literal("pending"),
        ),
        ...vTicketFailure,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (delivery?.status !== "accepted" && delivery?.status !== "partial") {
      return false;
    }
    await Promise.all(
      args.outcomes.map((outcome) =>
        recordReceiptOutcome(ctx, delivery._id, outcome),
      ),
    );
    const tickets = await getDeliveryTickets(ctx, delivery._id);
    await ctx.db.patch(delivery._id, {
      ...summarizeDeliveryTickets(tickets),
      tokenCount: tickets.length,
      updatedAt: Date.now(),
    });
    if (tickets.some((ticket) => ticket.status === "pending")) {
      await ctx.scheduler.runAfter(EXPO_RECEIPT_DELAY_MS, CHECK_RECEIPTS, {
        deliveryId: delivery._id,
      });
    }
    return true;
  },
});

async function recordReceiptOutcome(
  ctx: MutationCtx,
  deliveryId: Id<"notificationDeliveries">,
  outcome: ReceiptMutationOutcome,
) {
  const ticket = await ctx.db.get(outcome.pushTicketId);
  if (!ticket) return;
  if (ticket.deliveryId !== deliveryId || ticket.status !== "pending") return;
  const receiptAttempts = ticket.receiptAttempts + 1;
  const status = resolveReceiptStatus(outcome.status, receiptAttempts);
  await ctx.db.patch(ticket._id, {
    status,
    receiptAttempts,
    ...getReceiptFailureFields(status, outcome),
    updatedAt: Date.now(),
  });
  await disableUnregisteredToken(ctx, ticket.tokenId, outcome.errorCode);
}

function getReceiptFailureFields(
  status: ReceiptMutationOutcome["status"],
  outcome: ReceiptMutationOutcome,
) {
  if (status !== "failed") {
    return { failureKind: undefined, errorCode: undefined, error: undefined };
  }
  return {
    failureKind: outcome.failureKind ?? "transient",
    errorCode: outcome.errorCode ?? "ReceiptNotAvailable",
    error: outcome.error?.slice(0, 500),
  };
}

async function disableUnregisteredToken(
  ctx: MutationCtx,
  tokenId: Id<"mobilePushTokens">,
  errorCode: string | undefined,
) {
  if (!shouldDisableExpoPushToken(errorCode)) return;
  const token = await ctx.db.get(tokenId);
  if (token?.enabled) {
    await ctx.db.patch(token._id, { enabled: false, updatedAt: Date.now() });
  }
}

async function getDeliveryTickets(
  ctx: MutationCtx,
  deliveryId: Id<"notificationDeliveries">,
) {
  return await ctx.db
    .query("notificationPushTickets")
    .withIndex("by_delivery", (q) => q.eq("deliveryId", deliveryId))
    .collect();
}
