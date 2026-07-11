import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

interface InboxStateMessage<TId extends string> {
  _id: TId;
  inInbox: boolean;
  isPinned: boolean;
  receivedAt: number;
}

export function getThreadInboxState<TId extends string>(
  messages: InboxStateMessage<TId>[],
) {
  const inboxMessages = messages.filter((message) => message.inInbox);
  const latestInboxMessage = inboxMessages.reduce<
    InboxStateMessage<TId> | undefined
  >(
    (latest, message) =>
      !latest || message.receivedAt > latest.receivedAt ? message : latest,
    undefined,
  );
  return {
    inInbox: latestInboxMessage !== undefined,
    isPinned: inboxMessages.some((message) => message.isPinned),
    latestInboxMessage,
    latestInboxMessageAt: latestInboxMessage?.receivedAt,
    latestInboxMessageId: latestInboxMessage?._id,
  };
}

export function getThreadRowFlags(
  thread: { unreadCount: number; isPinned?: boolean },
  legacyPinned: boolean,
) {
  return {
    isRead: thread.unreadCount === 0,
    isPinned: thread.isPinned ?? legacyPinned,
  };
}

export function getThreadProjectionUpdate<TId extends string>(
  currentLatestMessageAt: number,
  messages: InboxStateMessage<TId>[],
) {
  const state = getThreadInboxState(messages);
  const latestMessageAt = messages.reduce(
    (latest, message) => Math.max(latest, message.receivedAt),
    currentLatestMessageAt,
  );
  return {
    latestMessageAt: state.latestInboxMessageAt ?? latestMessageAt,
    latestInboxMessageAt: state.latestInboxMessageAt,
    latestInboxMessageId: state.latestInboxMessageId,
    inInbox: state.inInbox,
    isPinned: state.isPinned,
  };
}

export async function updateThreadInboxProjection(
  ctx: MutationCtx,
  threadId: Id<"threads">,
) {
  const [thread, messages] = await Promise.all([
    ctx.db.get(threadId),
    ctx.db
      .query("messages")
      .withIndex("by_thread_received", (q) => q.eq("threadId", threadId))
      .collect(),
  ]);
  if (!thread) return;
  const state = getThreadInboxState(messages);
  await ctx.db.patch(threadId, {
    latestInboxMessageAt: state.latestInboxMessageAt,
    latestInboxMessageId: state.latestInboxMessageId,
    inInbox: state.inInbox,
    isPinned: state.isPinned,
    updatedAt: Date.now(),
  });
}
