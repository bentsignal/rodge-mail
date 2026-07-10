import { v } from "convex/values";

import { authedMutation } from "../utils";
import { ensureOwnedMessage } from "./helpers";

export const setPinned = authedMutation({
  args: {
    messageId: v.id("messages"),
    isPinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const message = await ensureOwnedMessage(ctx, ctx.ownerId, args.messageId);
    if (message.isPinned === args.isPinned) return;

    await ctx.db.patch(message._id, {
      isPinned: args.isPinned,
      updatedAt: Date.now(),
    });
  },
});

export const setRead = authedMutation({
  args: {
    messageId: v.id("messages"),
    isRead: v.boolean(),
  },
  handler: async (ctx, args) => {
    const message = await ensureOwnedMessage(ctx, ctx.ownerId, args.messageId);
    if (message.isRead === args.isRead) return;

    const thread = await ctx.db.get(message.threadId);
    if (!thread || thread.ownerId !== ctx.ownerId) return;

    await Promise.all([
      ctx.db.patch(message._id, {
        isRead: args.isRead,
        updatedAt: Date.now(),
      }),
      ctx.db.patch(thread._id, {
        unreadCount: Math.max(0, thread.unreadCount + (args.isRead ? -1 : 1)),
        updatedAt: Date.now(),
      }),
    ]);
  },
});
