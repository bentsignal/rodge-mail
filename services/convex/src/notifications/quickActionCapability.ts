import { makeFunctionReference } from "convex/server";

import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { randomBase64Url, sha256Base64Url } from "../providers/crypto";
import { urls } from "../urls";

const QUICK_ACTION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const SET_QUICK_ACTION_CAPABILITY = makeFunctionReference<
  "mutation",
  {
    deliveryId: Id<"notificationDeliveries">;
    expiresAt: number;
    tokenHash: string;
  },
  boolean
>("notifications/internal:setQuickActionCapability");

export async function createQuickActionCapability(
  ctx: ActionCtx,
  deliveryId: Id<"notificationDeliveries">,
) {
  const token = randomBase64Url(32);
  const stored = await ctx.runMutation(SET_QUICK_ACTION_CAPABILITY, {
    deliveryId,
    expiresAt: Date.now() + QUICK_ACTION_LIFETIME_MS,
    tokenHash: await sha256Base64Url(token),
  });
  if (!stored) {
    throw new Error("Notification quick-action capability could not be stored");
  }
  return {
    deliveryId,
    token,
    url: `${urls.convex.site}/notifications/quick-action`,
  };
}
