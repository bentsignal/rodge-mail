import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { authedMutation } from "../utils";
import {
  getRestoredInboxFlags,
  isPermanentlyDeletableArchive,
} from "./archive";
import { collectMessageRecords, deleteMessageRecords } from "./cleanupRecords";
import { ensureOwnedAccount, ensureOwnedThread } from "./helpers";
import { isAllMailLocation, resolveMessageLocation } from "./location";
import { getThreadInboxState } from "./threadState";

export const restoreArchivedThread = authedMutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ensureOwnedThread(ctx, ctx.ownerId, args.threadId);
    const messages = await getThreadMessages(ctx, thread._id);
    if (!messages.some((message) => message.archivedAt !== undefined)) {
      throw new ConvexError("Archived thread not found");
    }
    await moveMessagesToInbox(ctx, thread, messages);
    return { restoredMessages: messages.length };
  },
});

/**
 * Puts a thread back in the inbox from Rodge's archive, or from an imported
 * folder on a hosted mailbox, where Rodge is the only copy. Other providers
 * own their folders, and their next sync would move the mail back out.
 */
export const moveThreadToInbox = authedMutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ensureOwnedThread(ctx, ctx.ownerId, args.threadId);
    const account = await ensureOwnedAccount(
      ctx,
      ctx.ownerId,
      thread.accountId,
    );
    const messages = await getThreadMessages(ctx, thread._id);
    if (messages.some((message) => message.inInbox)) {
      return { movedMessages: 0 };
    }
    const isArchived = messages.some(
      (message) => message.archivedAt !== undefined,
    );
    if (!isArchived && account.provider !== "hosted") {
      throw new ConvexError("Move this conversation in your mail provider");
    }
    const movable = messages.filter((message) =>
      isAllMailLocation(
        message,
        resolveMessageLocation(message, account.provider) ?? {
          kind: "archive",
        },
      ),
    );
    await moveMessagesToInbox(ctx, thread, movable);
    return { movedMessages: movable.length };
  },
});

async function getThreadMessages(ctx: MutationCtx, threadId: Id<"threads">) {
  return await ctx.db
    .query("messages")
    .withIndex("by_thread_received", (q) => q.eq("threadId", threadId))
    .collect();
}

async function moveMessagesToInbox(
  ctx: MutationCtx,
  thread: Doc<"threads">,
  messages: Doc<"messages">[],
) {
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
}

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
