import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { deleteEmbeddingRecords } from "../embedding/storage";
import { ensureOwnedThread } from "./helpers";
import { scheduleProviderReadUpdate } from "./readUpdates";

export async function setOwnedThreadPinned(
  ctx: MutationCtx,
  ownerId: string,
  threadId: Id<"threads">,
  isPinned: boolean,
) {
  const thread = await ensureOwnedThread(ctx, ownerId, threadId);
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
    .collect();
  await Promise.all([
    ...messages
      .filter((message) => message.isPinned !== isPinned)
      .map((message) =>
        ctx.db.patch(message._id, {
          isPinned,
          updatedAt: Date.now(),
        }),
      ),
    ctx.db.patch(thread._id, {
      isPinned,
      updatedAt: Date.now(),
    }),
  ]);
}

export async function setOwnedThreadRead(
  ctx: MutationCtx,
  ownerId: string,
  threadId: Id<"threads">,
  isRead: boolean,
) {
  const thread = await ensureOwnedThread(ctx, ownerId, threadId);
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
    .collect();
  const account = await ctx.db.get(thread.accountId);
  const now = Date.now();
  const changedMessages = messages.filter(
    (message) => message.isRead !== isRead,
  );
  await Promise.all([
    ...changedMessages.map(async (message) => {
      await ctx.db.patch(message._id, {
        isRead,
        updatedAt: now,
      });
    }),
    ctx.db.patch(thread._id, {
      unreadCount: isRead ? 0 : messages.length,
      updatedAt: now,
    }),
    ...changedMessages.flatMap((message, index) => {
      const update = scheduleProviderReadUpdate({
        ctx,
        ownerId,
        account,
        message,
        isRead,
        delay: index * 100,
      });
      return update ? [update] : [];
    }),
  ]);
}

export async function archiveOwnedThread(
  ctx: MutationCtx,
  ownerId: string,
  threadId: Id<"threads">,
) {
  const thread = await ensureOwnedThread(ctx, ownerId, threadId);
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
    .collect();
  const now = Date.now();

  await Promise.all([
    ...messages.map(async (message) => {
      const existingTombstone = await ctx.db
        .query("archivedMessageTombstones")
        .withIndex("by_account_remote", (q) =>
          q
            .eq("accountId", message.accountId)
            .eq("remoteMessageId", message.remoteMessageId),
        )
        .unique();
      if (!existingTombstone) {
        await ctx.db.insert("archivedMessageTombstones", {
          ownerId,
          accountId: message.accountId,
          remoteMessageId: message.remoteMessageId,
          archivedAt: now,
          createdAt: now,
        });
      }
      await ctx.db.patch(message._id, {
        archivedAt: now,
        archivedFromInbox: message.inInbox,
        inInbox: false,
        isPinned: false,
        updatedAt: now,
      });
      await deleteEmbeddingRecords(ctx, message._id);
    }),
    ctx.db.patch(thread._id, {
      unreadCount: 0,
      archivedAt: now,
      inInbox: false,
      isPinned: false,
      latestInboxMessageAt: undefined,
      latestInboxMessageId: undefined,
      updatedAt: now,
    }),
  ]);

  return { archivedMessages: messages.length };
}
