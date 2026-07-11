import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { NotificationFailureKind, ParsedPushReceipt } from "./expo";
import type { NotificationPreferenceValues } from "./preferences";
import { internalAction } from "../_generated/server";
import {
  classifyHttpFailure,
  EXPO_PUSH_BATCH_SIZE,
  parseExpoPushReceipts,
  parseExpoPushTickets,
} from "./expo";
import { buildNewMailPush } from "./payload";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
interface DeliveryInput {
  delivery: Doc<"notificationDeliveries">;
  message: Doc<"messages">;
  preference: NotificationPreferenceValues;
  tokens: Doc<"mobilePushTokens">[];
}

interface PushTicketOutcome {
  tokenId: Id<"mobilePushTokens">;
  status: "accepted" | "failed";
  ticketId?: string;
  failureKind?: NotificationFailureKind;
  errorCode?: string;
  error?: string;
}

interface PendingReceiptInput {
  delivery: Doc<"notificationDeliveries">;
  tickets: Doc<"notificationPushTickets">[];
}

const GET_DELIVERY_INPUT = makeFunctionReference<
  "query",
  { deliveryId: Id<"notificationDeliveries"> },
  DeliveryInput | null
>("notifications/internal:getDeliveryInput");
const CLAIM_DELIVERY = makeFunctionReference<
  "mutation",
  { deliveryId: Id<"notificationDeliveries"> },
  boolean
>("notifications/internal:claimDelivery");
const COMPLETE_DELIVERY = makeFunctionReference<
  "mutation",
  {
    deliveryId: Id<"notificationDeliveries">;
    status: "failed" | "sent" | "skipped";
    tokenCount: number;
    error?: string;
  },
  boolean
>("notifications/internal:completeDelivery");
const RECORD_PUSH_TICKETS = makeFunctionReference<
  "mutation",
  {
    deliveryId: Id<"notificationDeliveries">;
    outcomes: PushTicketOutcome[];
  },
  boolean
>("notifications/deliveryState:recordPushTickets");
const GET_PENDING_RECEIPTS = makeFunctionReference<
  "query",
  { deliveryId: Id<"notificationDeliveries"> },
  PendingReceiptInput | null
>("notifications/deliveryState:getPendingReceiptInput");
const RECORD_RECEIPTS = makeFunctionReference<
  "mutation",
  {
    deliveryId: Id<"notificationDeliveries">;
    outcomes: {
      pushTicketId: Id<"notificationPushTickets">;
      status: "delivered" | "failed" | "pending";
      failureKind?: NotificationFailureKind;
      errorCode?: string;
      error?: string;
    }[];
  },
  boolean
>("notifications/deliveryState:recordReceiptOutcomes");

export const sendNewMail = internalAction({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(GET_DELIVERY_INPUT, args);
    if (!input) return null;
    const claimed = await ctx.runMutation(CLAIM_DELIVERY, args);
    if (!claimed) return null;

    await deliverNewMail(ctx, args.deliveryId, input);
    return null;
  },
});

export const checkReceipts = internalAction({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(GET_PENDING_RECEIPTS, args);
    if (!input || input.tickets.length === 0) return null;
    const outcomes = await fetchReceiptOutcomes(input.tickets);
    await ctx.runMutation(RECORD_RECEIPTS, {
      deliveryId: args.deliveryId,
      outcomes,
    });
    return null;
  },
});

async function deliverNewMail(
  ctx: ActionCtx,
  deliveryId: Id<"notificationDeliveries">,
  input: DeliveryInput,
) {
  const enabled = input.preference.newMailEnabled;
  if (!enabled || input.tokens.length === 0) {
    await complete({
      ctx,
      deliveryId,
      status: "skipped",
      tokenCount: input.tokens.length,
    });
    return;
  }

  const notification = buildNewMailPush(
    input.message,
    input.preference.includePreview,
  );
  const batches = chunk(input.tokens, EXPO_PUSH_BATCH_SIZE);
  const outcomes = (
    await Promise.all(
      batches.map((tokens) => sendPushBatch(tokens, notification)),
    )
  ).flat();
  await ctx.runMutation(RECORD_PUSH_TICKETS, { deliveryId, outcomes });
}

async function sendPushBatch(
  tokens: Doc<"mobilePushTokens">[],
  notification: ReturnType<typeof buildNewMailPush>,
) {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify(
        tokens.map((token) => ({ to: token.token, ...notification })),
      ),
    });
    if (!response.ok) return httpPushFailures(tokens, response.status);
    const payload = await response.json().then((value: unknown) => value);
    return parseExpoPushTickets(payload, tokens.length).map((ticket, index) => {
      const token = getAt(
        tokens,
        index,
        "Expo push ticket has no matching token",
      );
      return ticket.status === "accepted"
        ? {
            tokenId: token._id,
            status: "accepted" as const,
            ticketId: ticket.ticketId,
          }
        : {
            tokenId: token._id,
            status: "failed" as const,
            failureKind: ticket.failureKind,
            errorCode: ticket.errorCode,
            error: ticket.error,
          };
    });
  } catch (error) {
    return tokens.map((token) => ({
      tokenId: token._id,
      status: "failed" as const,
      failureKind: "transient" as const,
      errorCode: "ExpoRequestFailed",
      error:
        error instanceof Error ? error.message : "Expo push request failed",
    }));
  }
}

async function fetchReceiptOutcomes(tickets: Doc<"notificationPushTickets">[]) {
  try {
    const expoTicketIds = tickets.map((ticket) => {
      if (!ticket.expoTicketId) throw new Error("Pending ticket is missing id");
      return ticket.expoTicketId;
    });
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify({ ids: expoTicketIds }),
    });
    if (!response.ok) {
      return receiptRequestFailures(tickets, response.status);
    }
    const payload = await response.json().then((value: unknown) => value);
    return parseExpoPushReceipts(payload, expoTicketIds).map(
      (receipt, index) => {
        const ticket = getAt(
          tickets,
          index,
          "Expo receipt has no matching ticket",
        );
        return toReceiptOutcome(ticket._id, receipt);
      },
    );
  } catch (error) {
    return tickets.map((ticket) => ({
      pushTicketId: ticket._id,
      status: "pending" as const,
      failureKind: "transient" as const,
      errorCode: "ExpoReceiptRequestFailed",
      error:
        error instanceof Error ? error.message : "Expo receipt request failed",
    }));
  }
}

function toReceiptOutcome(
  pushTicketId: Id<"notificationPushTickets">,
  receipt: ParsedPushReceipt,
) {
  if (receipt.status !== "failed") {
    return { pushTicketId, status: receipt.status };
  }
  return {
    pushTicketId,
    status: receipt.status,
    failureKind: receipt.failureKind,
    errorCode: receipt.errorCode,
    error: receipt.error,
  };
}

function httpPushFailures(tokens: Doc<"mobilePushTokens">[], status: number) {
  return tokens.map((token) => ({
    tokenId: token._id,
    status: "failed" as const,
    failureKind: classifyHttpFailure(status),
    errorCode: `ExpoHttp${status}`,
    error: `Expo push request failed (${status})`,
  }));
}

function receiptRequestFailures(
  tickets: Doc<"notificationPushTickets">[],
  status: number,
) {
  const failureKind = classifyHttpFailure(status);
  return tickets.map((ticket) => {
    const outcomeStatus =
      failureKind === "permanent" ? ("failed" as const) : ("pending" as const);
    return {
      pushTicketId: ticket._id,
      status: outcomeStatus,
      failureKind,
      errorCode: `ExpoReceiptHttp${status}`,
      error: `Expo receipt request failed (${status})`,
    };
  });
}

function chunk<T>(values: T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );
}

function getAt<T>(values: T[], index: number, error: string) {
  const value = values[index];
  if (value === undefined) throw new Error(error);
  return value;
}

function expoHeaders() {
  return {
    accept: "application/json",
    "accept-encoding": "gzip, deflate",
    "content-type": "application/json",
  };
}

async function complete(args: {
  ctx: ActionCtx;
  deliveryId: Id<"notificationDeliveries">;
  status: "failed" | "sent" | "skipped";
  tokenCount: number;
  error?: string;
}) {
  const { ctx, ...values } = args;
  await ctx.runMutation(COMPLETE_DELIVERY, {
    ...values,
  });
}
