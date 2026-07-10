import { ConvexError, v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";
import {
  vClassificationCategory,
  vClassificationSource,
  vFocusBucket,
} from "../mail/validators";

export const listPending = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messageClassifications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(Math.max(1, Math.min(100, Math.floor(args.limit))));
  },
});

export const queue = internalMutation({
  args: {
    ownerId: v.string(),
    messageId: v.id("messages"),
    promptVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.ownerId !== args.ownerId) {
      throw new ConvexError("Message not found");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("messageClassifications")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first();

    await ctx.db.patch(message._id, {
      focusBucket: "unclassified",
      updatedAt: now,
    });
    if (existing) {
      await ctx.db.patch(existing._id, {
        bucket: "unclassified",
        confidence: 0,
        error: undefined,
        importance: 0,
        promptVersion: args.promptVersion,
        shouldEmbed: false,
        source: "rules",
        status: "pending",
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("messageClassifications", {
      ownerId: args.ownerId,
      messageId: args.messageId,
      status: "pending",
      bucket: "unclassified",
      importance: 0,
      confidence: 0,
      shouldEmbed: false,
      source: "rules",
      promptVersion: args.promptVersion,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const complete = internalMutation({
  args: {
    messageId: v.id("messages"),
    bucket: vFocusBucket,
    category: vClassificationCategory,
    importance: v.number(),
    confidence: v.number(),
    reason: v.string(),
    summary: v.string(),
    shouldEmbed: v.boolean(),
    source: vClassificationSource,
    promptVersion: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.bucket === "unclassified") {
      throw new ConvexError("Completed classification needs a bucket");
    }
    assertProbability(args.importance, "importance");
    assertProbability(args.confidence, "confidence");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError("Message not found");
    const existing = await ctx.db
      .query("messageClassifications")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first();
    const now = Date.now();
    const classification = {
      bucket: args.bucket,
      category: args.category,
      classifiedAt: now,
      confidence: args.confidence,
      error: undefined,
      importance: args.importance,
      model: args.model,
      promptVersion: args.promptVersion,
      reason: args.reason,
      shouldEmbed: args.shouldEmbed,
      source: args.source,
      status: "classified" as const,
      summary: args.summary,
      updatedAt: now,
    };

    await ctx.db.patch(message._id, {
      focusBucket: args.bucket,
      updatedAt: now,
    });
    if (existing) {
      await ctx.db.patch(existing._id, classification);
      return existing._id;
    }
    return await ctx.db.insert("messageClassifications", {
      ownerId: message.ownerId,
      messageId: message._id,
      ...classification,
      createdAt: now,
    });
  },
});

export const fail = internalMutation({
  args: {
    messageId: v.id("messages"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messageClassifications")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first();
    if (!existing) throw new ConvexError("Classification not found");
    await ctx.db.patch(existing._id, {
      error: args.error,
      status: "failed",
      updatedAt: Date.now(),
    });
  },
});

function assertProbability(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ConvexError(`${field} must be between 0 and 1`);
  }
}
