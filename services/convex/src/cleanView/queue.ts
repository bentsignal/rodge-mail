import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  CLEAN_VIEW_OUTPUT_SCHEMA_VERSION,
  CLEAN_VIEW_PROMPT_VERSION,
} from "../classification/constants";
import { normalizeMail, stableHash } from "../classification/normalize";
import { canQueueCleanView } from "./policy";

const RUN_CLEAN_VIEW = makeFunctionReference<
  "action",
  { messageId: Id<"messages">; jobKey: string }
>("cleanView/actions:run");

export async function queueCleanViewForMessage(
  ctx: MutationCtx,
  args: {
    ownerId: string;
    messageId: Id<"messages">;
  },
) {
  const [message, content, existing] = await Promise.all([
    ctx.db.get(args.messageId),
    ctx.db
      .query("messageContents")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique(),
    ctx.db
      .query("messageCleanViews")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique(),
  ]);
  if (!message || message.ownerId !== args.ownerId) {
    throw new ConvexError("Message not found");
  }
  if (!canQueueCleanView(existing)) {
    return { queued: false };
  }

  const now = Date.now();
  const inputHash = stableHash(normalizeMail(message, content));
  const jobKey = `${CLEAN_VIEW_PROMPT_VERSION}:${message._id}:${inputHash}:${now}`;
  const values = {
    status: "pending" as const,
    promptVersion: CLEAN_VIEW_PROMPT_VERSION,
    outputSchemaVersion: CLEAN_VIEW_OUTPUT_SCHEMA_VERSION,
    jobKey,
    inputHash,
    summary: existing?.summary,
    cleanedMarkdown: existing?.cleanedMarkdown,
    model: existing?.model,
    error: undefined,
    generatedAt: existing?.generatedAt,
    updatedAt: now,
  };
  if (existing) {
    await ctx.db.patch(existing._id, values);
  } else {
    await ctx.db.insert("messageCleanViews", {
      ownerId: args.ownerId,
      messageId: message._id,
      ...values,
      createdAt: now,
    });
  }
  await ctx.scheduler.runAfter(0, RUN_CLEAN_VIEW, {
    messageId: message._id,
    jobKey,
  });
  return { queued: true };
}
