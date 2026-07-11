import { v } from "convex/values";

import {
  queueEmbeddingForMessage,
  reconcileEmbeddingSelection,
} from "../embedding/internal";
import {
  ensureOwnedMessage,
  getClassificationForMessage,
} from "../mail/helpers";
import { vClassificationCategory, vFocusBucket } from "../mail/validators";
import { resolveNewMailNotification } from "../notifications/internal";
import { authedMutation } from "../utils";
import {
  CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
  CLASSIFICATION_PROMPT_VERSION,
} from "./constants";
import { isImportantMessage } from "./importance";
import { queueClassificationForMessage } from "./internal";

export const setManualOverride = authedMutation({
  args: {
    messageId: v.id("messages"),
    bucket: vFocusBucket,
    category: vClassificationCategory,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.bucket === "unclassified") {
      throw new Error("Manual classification needs a focused or other bucket");
    }
    const message = await ensureOwnedMessage(ctx, ctx.ownerId, args.messageId);
    const existing = await getClassificationForMessage(ctx, message._id);
    const now = Date.now();
    const values = {
      status: "classified" as const,
      bucket: args.bucket,
      category: args.category,
      importance: args.bucket === "focused" ? 1 : 0.2,
      confidence: 1,
      reason: (args.reason ?? "Priority set manually").slice(0, 240),
      summary: existing?.summary,
      shouldEmbed: message.inInbox,
      source: "manual" as const,
      promptVersion: "manual-v1",
      outputSchemaVersion: CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
      jobKey: `manual:${message._id}:${now}`,
      inputHash: existing?.inputHash,
      attempt: 0,
      nextAttemptAt: undefined,
      model: undefined,
      error: undefined,
      classifiedAt: now,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
    } else {
      await ctx.db.insert("messageClassifications", {
        ownerId: ctx.ownerId,
        messageId: message._id,
        ...values,
        createdAt: now,
      });
    }
    await ctx.db.patch(message._id, {
      focusBucket: args.bucket,
      updatedAt: now,
    });
    await reconcileEmbeddingSelection(ctx, message._id);
    await resolveNewMailNotification(ctx, {
      important: isImportantMessage(values.importance),
      messageId: message._id,
      ownerId: ctx.ownerId,
    });
  },
});

export const clearManualOverride = authedMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ensureOwnedMessage(ctx, ctx.ownerId, args.messageId);
    const existing = await getClassificationForMessage(ctx, message._id);
    if (existing?.source !== "manual") return;
    await queueClassificationForMessage(ctx, {
      ownerId: ctx.ownerId,
      messageId: message._id,
      promptVersion: CLASSIFICATION_PROMPT_VERSION,
      replaceManual: true,
    });
  },
});

export const setEmbeddingSelected = authedMutation({
  args: { messageId: v.id("messages"), selected: v.boolean() },
  handler: async (ctx, args) => {
    const message = await ensureOwnedMessage(ctx, ctx.ownerId, args.messageId);
    if (args.selected) {
      await queueEmbeddingForMessage(ctx, {
        ownerId: ctx.ownerId,
        messageId: message._id,
        reason: "selected",
      });
      return;
    }
    await reconcileEmbeddingSelection(ctx, message._id, true);
  },
});
