import { makeFunctionReference } from "convex/server";

import type { NotificationQuickAction } from "./quickAction";
import { httpAction } from "../_generated/server";
import { sha256Base64Url } from "../providers/crypto";
import { parseQuickActionRequest } from "./quickAction";

const PERFORM_QUICK_ACTION = makeFunctionReference<
  "mutation",
  {
    action: NotificationQuickAction;
    deliveryId: string;
    tokenHash: string;
  },
  boolean
>("notifications/internal:performQuickAction");

export const performQuickAction = httpAction(async (ctx, request) => {
  const input = await request
    .json()
    .then(parseQuickActionRequest)
    .catch(() => undefined);
  if (!input) return rejectedResponse();

  const performed = await ctx
    .runMutation(PERFORM_QUICK_ACTION, {
      action: input.action,
      deliveryId: input.deliveryId,
      tokenHash: await sha256Base64Url(input.token),
    })
    .catch(() => false);
  return performed ? new Response(null, { status: 204 }) : rejectedResponse();
});

function rejectedResponse() {
  return new Response(null, { status: 401 });
}
