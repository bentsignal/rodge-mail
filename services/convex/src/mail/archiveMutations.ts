import { ConvexError, v } from "convex/values";

import { authedMutation } from "../utils";
import {
  getRestoredInboxFlags,
  isPermanentlyDeletableArchive,
} from "./archive";
import { collectMessageRecords, deleteMessageRecords } from "./cleanupRecords";
import { ensureOwnedThread } from "./helpers";
import { getThreadInboxState } from "./threadState";

export const restoreArchivedThread = authedMutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ensureOwnedThread(ctx, ctx.ownerId, args.threadId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
      .collect();
    if (!messages.some((message) => message.archivedAt !== undefined)) {
      throw new ConvexError("Archived thread not found");
    }

    const now = Date.now();
    const restoredInboxFlags = getRestoredInboxFlags(messages);
    await Promise.all(
      messages.map(async (message, index) => {
        const tombstone = await ctx.db
          .query("archivedMessageTombstones")
          .withIndex("by_account_remote", (q) =>
            q
              .eq("accountId", message.accountId)
              .eq("remoteMessageId", message.remoteMessageId),
          )
          .unique();
        if (tombstone) await ctx.db.delete(tombstone._id);
        await ctx.db.patch(message._id, {
          archivedAt: undefined,
          archivedFromInbox: undefined,
          inInbox: restoredInboxFlags[index] ?? false,
          isPinned: false,
          updatedAt: now,
        });
      }),
    );

    const restoredMessages = messages.map((message, index) => ({
      ...message,
      inInbox: restoredInboxFlags[index] ?? false,
      isPinned: false,
    }));
    const inboxState = getThreadInboxState(restoredMessages);
    await ctx.db.patch(thread._id, {
      archivedAt: undefined,
      inInbox: inboxState.inInbox,
      isPinned: false,
      latestInboxMessageAt: inboxState.latestInboxMessageAt,
      latestInboxMessageId: inboxState.latestInboxMessageId,
      unreadCount: restoredMessages.filter(
        (message) => message.inInbox && !message.isRead,
      ).length,
      updatedAt: now,
    });
    return { restoredMessages: messages.length };
  },
});

export const permanentlyDeleteArchivedThread = authedMutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ensureOwnedThread(ctx, ctx.ownerId, args.threadId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
      .collect();
    if (!isPermanentlyDeletableArchive(thread, messages)) {
      throw new ConvexError("Only archived threads can be permanently deleted");
    }

    const records = await Promise.all(
      messages.map(
        async (message) => await collectMessageRecords(ctx, message),
      ),
    );
    const storageIds = new Set(records.flatMap((record) => record.storageIds));
    for (const storageId of storageIds) await ctx.storage.delete(storageId);
    for (const record of records) await deleteMessageRecords(ctx, record);
    await ctx.db.delete(thread._id);
    return { deletedMessages: messages.length };
  },
});
