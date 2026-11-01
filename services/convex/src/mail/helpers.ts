import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getMailingListInfo } from "../mailingLists/policy";
import { getMessageLocation, isAllMailLocation } from "./location";
import { getThreadRowFlags } from "./threadState";

type ReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

/** An account being removed is hidden everywhere until its rows are gone. */
export function isActiveAccount(
  account: Doc<"mailAccounts"> | null,
): account is Doc<"mailAccounts"> {
  return account !== null && account.deletingAt === undefined;
}

export async function getActiveAccount(
  ctx: ReadCtx,
  accountId: Id<"mailAccounts">,
) {
  const account = await ctx.db.get(accountId);
  return isActiveAccount(account) ? account : null;
}

export async function ensureOwnedAccount(
  ctx: ReadCtx,
  ownerId: string,
  accountId: Id<"mailAccounts">,
) {
  const account = await getActiveAccount(ctx, accountId);
  if (account?.ownerId !== ownerId) {
    throw new ConvexError("Mail account not found");
  }
  return account;
}

/**
 * For list queries: a removed account reads as empty instead of failing, so a
 * client still filtered to it keeps rendering.
 */
export async function ensureListableAccount(
  ctx: ReadCtx,
  ownerId: string,
  accountId: Id<"mailAccounts">,
) {
  const account = await ctx.db.get(accountId);
  if (account && account.ownerId !== ownerId) {
    throw new ConvexError("Mail account not found");
  }
}

export async function ensureOwnedMessage(
  ctx: ReadCtx,
  ownerId: string,
  messageId: Id<"messages">,
) {
  const message = await ctx.db.get(messageId);
  if (
    message?.ownerId !== ownerId ||
    !(await getActiveAccount(ctx, message.accountId))
  ) {
    throw new ConvexError("Message not found");
  }
  return message;
}

export async function ensureOwnedThread(
  ctx: ReadCtx,
  ownerId: string,
  threadId: Id<"threads">,
) {
  const thread = await ctx.db.get(threadId);
  if (
    thread?.ownerId !== ownerId ||
    !(await getActiveAccount(ctx, thread.accountId))
  ) {
    throw new ConvexError("Thread not found");
  }
  return thread;
}

export async function getClassificationForMessage(
  ctx: Pick<QueryCtx, "db">,
  messageId: Id<"messages">,
) {
  return await ctx.db
    .query("messageClassifications")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .first();
}

export async function getContentForMessage(
  ctx: Pick<QueryCtx, "db">,
  messageId: Id<"messages">,
) {
  return await ctx.db
    .query("messageContents")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .first();
}

export async function getCleanViewForMessage(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  messageId: Id<"messages">,
) {
  return await ctx.db
    .query("messageCleanViews")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .unique();
}

export async function toMessageListItem(
  ctx: Pick<QueryCtx, "db">,
  message: Doc<"messages">,
) {
  const [account, classification] = await Promise.all([
    ctx.db.get(message.accountId),
    getClassificationForMessage(ctx, message._id),
  ]);
  if (!account) {
    throw new ConvexError("Message account not found");
  }
  if (!isActiveAccount(account)) return null;
  const location = await getMessageLocation(ctx, message, account.provider);

  return {
    ...message,
    location,
    account: {
      _id: account._id,
      address: account.address,
      displayName: account.displayName,
      provider: account.provider,
    },
    classification,
    mailingList: getMailingListPresentation(message, classification?.category),
  };
}

function getMailingListPresentation(
  message: Doc<"messages">,
  category: string | undefined,
) {
  const info = getMailingListInfo(message, category);
  if (!info) return undefined;
  return {
    displayName: info.displayName,
    remoteMethod: info.remoteMethod,
  };
}

export async function toThreadListItem(
  ctx: Pick<QueryCtx, "db">,
  thread: Doc<"threads">,
) {
  const projectedMessage = thread.latestInboxMessageId
    ? await ctx.db.get(thread.latestInboxMessageId)
    : null;
  const latestMessage =
    projectedMessage?.threadId === thread._id && projectedMessage.inInbox
      ? projectedMessage
      : await ctx.db
          .query("messages")
          .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
          .order("desc")
          .filter((q) => q.eq(q.field("inInbox"), true))
          .first();
  if (!latestMessage) return null;
  const [listItem, legacyPinnedMessage] = await Promise.all([
    toMessageListItem(ctx, latestMessage),
    thread.isPinned === undefined
      ? ctx.db
          .query("messages")
          .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
          .filter((q) =>
            q.and(
              q.eq(q.field("inInbox"), true),
              q.eq(q.field("isPinned"), true),
            ),
          )
          .first()
      : null,
  ]);
  if (!listItem) return null;
  return {
    ...listItem,
    ...getThreadRowFlags(thread, legacyPinnedMessage !== null),
    receivedAt: thread.latestInboxMessageAt ?? latestMessage.receivedAt,
  };
}

const ALL_MAIL_THREAD_SCAN = 20;

/**
 * An All Mail row: the inbox row when the thread is in the inbox, otherwise
 * its newest message that isn't junk, trash, or spam.
 */
export async function toAllMailThreadListItem(
  ctx: Pick<QueryCtx, "db">,
  thread: Doc<"threads">,
) {
  if (thread.inInbox !== false) {
    const inboxItem = await toThreadListItem(ctx, thread);
    if (inboxItem) return inboxItem;
  }
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
    .order("desc")
    .take(ALL_MAIL_THREAD_SCAN);
  for (const message of messages) {
    if (message.hiddenAt !== undefined) continue;
    const listItem = await toMessageListItem(ctx, message);
    if (!listItem) return null;
    if (
      !isAllMailLocation(message, listItem.location) ||
      listItem.classification?.isSpam === true
    ) {
      continue;
    }
    return {
      ...listItem,
      isPinned: false,
      isRead: thread.unreadCount === 0,
      receivedAt: message.receivedAt,
    };
  }
  return null;
}

export async function toArchivedThreadListItem(
  ctx: Pick<QueryCtx, "db">,
  thread: Doc<"threads">,
) {
  const latestArchivedMessage = await ctx.db
    .query("messages")
    .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
    .order("desc")
    .filter((q) => q.neq(q.field("archivedAt"), undefined))
    .first();
  if (!latestArchivedMessage || thread.archivedAt === undefined) return null;
  const listItem = await toMessageListItem(ctx, latestArchivedMessage);
  if (!listItem) return null;
  return {
    ...listItem,
    archivedAt: thread.archivedAt,
    isPinned: false,
    isRead: thread.unreadCount === 0,
    receivedAt: latestArchivedMessage.receivedAt,
  };
}

export async function toMessageDetail(
  ctx: Pick<QueryCtx, "db">,
  message: Doc<"messages">,
) {
  const [listItem, content, cleanView, attachments] = await Promise.all([
    toMessageListItem(ctx, message),
    getContentForMessage(ctx, message._id),
    getCleanViewForMessage(ctx, message._id),
    ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .collect(),
  ]);
  if (!listItem) throw new ConvexError("Message not found");

  return { ...listItem, attachments, cleanView, content };
}
