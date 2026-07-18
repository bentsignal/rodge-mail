import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { configuredClassificationModel } from "../classification/openai";

export const getJobInput = internalQuery({
  args: { messageId: v.id("messages"), jobKey: v.string() },
  handler: async (ctx, args) => {
    const [message, content, cleanView] = await Promise.all([
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
    if (!message || cleanView?.jobKey !== args.jobKey) return null;
    return { message, content };
  },
});

export const begin = internalMutation({
  args: { messageId: v.id("messages"), jobKey: v.string() },
  handler: async (ctx, args) => {
    const cleanView = await findCleanView(ctx, args.messageId);
    if (cleanView?.jobKey !== args.jobKey || cleanView.status !== "pending") {
      return false;
    }
    await ctx.db.patch(cleanView._id, {
      status: "running",
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const complete = internalMutation({
  args: {
    messageId: v.id("messages"),
    jobKey: v.string(),
    summary: v.string(),
    cleanedMarkdown: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanView = await findCleanView(ctx, args.messageId);
    if (cleanView?.jobKey !== args.jobKey || cleanView.status !== "running") {
      return false;
    }
    const now = Date.now();
    await ctx.db.patch(cleanView._id, {
      status: "ready",
      summary: args.summary.slice(0, 280),
      cleanedMarkdown: args.cleanedMarkdown.slice(0, 24_000),
      model: configuredClassificationModel(),
      error: undefined,
      generatedAt: now,
      updatedAt: now,
    });
    return true;
  },
});

export const fail = internalMutation({
  args: {
    messageId: v.id("messages"),
    jobKey: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanView = await findCleanView(ctx, args.messageId);
    if (cleanView?.jobKey !== args.jobKey) return false;
    await ctx.db.patch(cleanView._id, {
      status: "failed",
      error: args.error.slice(0, 500),
      updatedAt: Date.now(),
    });
    return true;
  },
});

async function findCleanView(ctx: MutationCtx, messageId: Id<"messages">) {
  return await ctx.db
    .query("messageCleanViews")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .unique();
}
