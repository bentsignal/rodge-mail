import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { buildNewMailPush } from "./payload";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
interface DeliveryInput {
  delivery: Doc<"notificationDeliveries">;
  message: Doc<"messages">;
  preference: Doc<"notificationPreferences"> | null;
  tokens: Doc<"mobilePushTokens">[];
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

async function deliverNewMail(
  ctx: ActionCtx,
  deliveryId: Id<"notificationDeliveries">,
  input: DeliveryInput,
) {
  const enabled = input.preference?.newMailEnabled ?? true;
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
    input.preference?.includePreview ?? true,
  );
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
      },
      body: JSON.stringify(
        input.tokens.map((token) => ({
          to: token.token,
          ...notification,
        })),
      ),
    });
    if (!response.ok) {
      throw new Error(`Expo push request failed (${response.status})`);
    }
    await complete({
      ctx,
      deliveryId,
      status: "sent",
      tokenCount: input.tokens.length,
    });
  } catch (error) {
    await complete({
      ctx,
      deliveryId,
      status: "failed",
      tokenCount: input.tokens.length,
      error:
        error instanceof Error ? error.message : "Expo push request failed",
    });
  }
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
