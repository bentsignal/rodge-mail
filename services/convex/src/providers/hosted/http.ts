import { internal } from "../../_generated/api";
import { httpAction } from "../../_generated/server";
import { hostedEnv } from "./env";

const MAX_NOTIFICATION_BYTES = 256 * 1024;

export const snsWebhook = httpAction(async (ctx, request) => {
  const expected = hostedEnv.HOSTED_MAIL_WEBHOOK_TOKEN;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!expected || !constantTimeEqual(token, expected)) {
    return new Response("Forbidden", { status: 403 });
  }
  const body = await request.text();
  if (body.length > MAX_NOTIFICATION_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }
  const result = await ctx.runAction(
    internal.providers.hosted.sns.handleNotification,
    { body },
  );
  return new Response(null, { status: result === "accepted" ? 200 : 400 });
});

function constantTimeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  for (let index = 0; index < right.length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
