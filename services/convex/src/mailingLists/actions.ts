"use node";

import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { AuthedActionCtx } from "../utils";
import { internal } from "../_generated/api";
import { authedAction } from "../utils";
import { isSafeOneClickUrl } from "./policy";

type RemoteStatus = "failed" | "requested" | "succeeded" | "unavailable";

export const unsubscribe = authedAction({
  args: { messageId: v.id("messages") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    displayName: string;
    remoteStatus: RemoteStatus;
    suppressionActive: true;
  }> => {
    const request = await ctx.runMutation(
      internal.mailingLists.internal.beginUnsubscribe,
      { ownerId: ctx.ownerId, messageId: args.messageId },
    );
    const remote = await performRemoteUnsubscribe(ctx, ctx.ownerId, request);
    await completeRemoteAttempt({
      ctx,
      ownerId: ctx.ownerId,
      suppressionId: request.suppressionId,
      status: remote.status,
      error: remote.error,
    });
    return {
      displayName: request.displayName,
      remoteStatus: remote.status,
      suppressionActive: true,
    };
  },
});

async function performRemoteUnsubscribe(
  ctx: AuthedActionCtx,
  ownerId: string,
  request: {
    oneClickUrl?: string;
    mailto?: { address: string; body: string; subject: string };
    suppressionId: Id<"mailingListSuppressions">;
  },
) {
  try {
    if (request.oneClickUrl) {
      try {
        await postOneClickUnsubscribe(request.oneClickUrl);
        return { status: "succeeded" as const };
      } catch (oneClickError) {
        if (!request.mailto) throw oneClickError;
        await queueUnsubscribeEmail(
          ctx,
          ownerId,
          request.suppressionId,
          request.mailto,
        );
        return { status: "requested" as const };
      }
    }
    if (request.mailto) {
      await queueUnsubscribeEmail(
        ctx,
        ownerId,
        request.suppressionId,
        request.mailto,
      );
      return { status: "requested" as const };
    }
    return { status: "unavailable" as const };
  } catch (error) {
    return { error: safeErrorMessage(error), status: "failed" as const };
  }
}

async function queueUnsubscribeEmail(
  ctx: AuthedActionCtx,
  ownerId: string,
  suppressionId: Id<"mailingListSuppressions">,
  mailto: { address: string; body: string; subject: string },
) {
  await ctx.runMutation(internal.mailingLists.internal.queueUnsubscribeEmail, {
    ownerId,
    suppressionId,
    ...mailto,
  });
}

async function completeRemoteAttempt(args: {
  ctx: AuthedActionCtx;
  ownerId: string;
  suppressionId: Id<"mailingListSuppressions">;
  status: RemoteStatus;
  error?: string;
}) {
  await args.ctx.runMutation(
    internal.mailingLists.internal.completeRemoteAttempt,
    {
      ownerId: args.ownerId,
      suppressionId: args.suppressionId,
      status: args.status,
      error: args.error,
    },
  );
}

async function postOneClickUnsubscribe(value: string) {
  let url = value;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (!isSafeOneClickUrl(url)) {
      throw new Error("The list supplied an unsafe unsubscribe endpoint");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        Accept: "text/plain, text/html;q=0.9, */*;q=0.1",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Rodge-Mail-Unsubscribe/1.0",
      },
      body: "List-Unsubscribe=One-Click",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (response.ok) return;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Unsubscribe redirect was incomplete");
      url = new URL(location, url).toString();
      continue;
    }
    throw new Error(`Unsubscribe endpoint returned ${response.status}`);
  }
  throw new Error("Unsubscribe endpoint redirected too many times");
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 240);
  return "The remote unsubscribe request failed";
}
