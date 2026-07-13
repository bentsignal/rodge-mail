import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import {
  CLEAN_VIEW_OUTPUT_SCHEMA_VERSION,
  CLEAN_VIEW_PROMPT_VERSION,
} from "../classification/constants";
import { normalizeMail, stableHash } from "../classification/normalize";
import { ensureOwnedMessage, getContentForMessage } from "../mail/helpers";
import { authedMutation } from "../utils";

const RUN_CLEAN_VIEW = makeFunctionReference<
  "action",
  { messageId: Id<"messages">; jobKey: string }
>("cleanView/actions:run");

export const generate = authedMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ensureOwnedMessage(ctx, ctx.ownerId, args.messageId);
    const [content, existing] = await Promise.all([
      getContentForMessage(ctx, message._id),
      ctx.db
        .query("messageCleanViews")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .unique(),
    ]);
    if (existing?.status === "pending" || existing?.status === "running") {
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
        ownerId: ctx.ownerId,
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
  },
});
