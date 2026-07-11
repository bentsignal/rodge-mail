import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getThreadRowFlags } from "./threadState";

type ReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export async function ensureOwnedAccount(
  ctx: ReadCtx,
  ownerId: string,
  accountId: Id<"mailAccounts">,
) {
  const account = await ctx.db.get(accountId);
  if (account?.ownerId !== ownerId) {
    throw new ConvexError("Mail account not found");
  }
  return account;
}

export async function ensureOwnedMessage(
  ctx: ReadCtx,
  ownerId: string,
  messageId: Id<"messages">,
) {
  const message = await ctx.db.get(messageId);
  if (message?.ownerId !== ownerId) {
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
  if (thread?.ownerId !== ownerId) {
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

  return {
    ...message,
    account: {
      _id: account._id,
      address: account.address,
      displayName: account.displayName,
      provider: account.provider,
    },
    classification,
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
  return {
    ...listItem,
    ...getThreadRowFlags(thread, legacyPinnedMessage !== null),
    receivedAt: thread.latestInboxMessageAt ?? latestMessage.receivedAt,
  };
}

export async function toMessageDetail(
  ctx: Pick<QueryCtx, "db">,
  message: Doc<"messages">,
) {
  const [listItem, content, attachments] = await Promise.all([
    toMessageListItem(ctx, message),
    getContentForMessage(ctx, message._id),
    ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .collect(),
  ]);

  return { ...listItem, attachments, content };
}
