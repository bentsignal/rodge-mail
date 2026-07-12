import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { deleteEmbeddingRecords } from "../embedding/storage";
import { authedMutation } from "../utils";
import {
  ensureOwnedAccount,
  ensureOwnedMessage,
  ensureOwnedThread,
} from "./helpers";
import {
  canRetryOutbox,
  getIdempotentEnqueueResult,
  getReadyDraftAttachments,
  getRetryOutboxUpdate,
  validateProviderAttachments,
  validateRecipientFields,
  validateSendRequest,
} from "./outbox";
import { scheduleProviderReadUpdate } from "./readUpdates";
import { resolveReplyMetadata } from "./replies";
import { updateThreadInboxProjection } from "./threadState";
import { vMailboxAddress } from "./validators";

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
    await updateThreadInboxProjection(ctx, message.threadId);
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

    const account = await ctx.db.get(message.accountId);
    const providerUpdate = scheduleProviderReadUpdate({
      ctx,
      account,
      message,
      isRead: args.isRead,
      delay: 0,
    });

    await Promise.all([
      ctx.db.patch(message._id, {
        isRead: args.isRead,
        updatedAt: Date.now(),
      }),
      ctx.db.patch(thread._id, {
        unreadCount: Math.max(0, thread.unreadCount + (args.isRead ? -1 : 1)),
        updatedAt: Date.now(),
      }),
      ...(providerUpdate ? [providerUpdate] : []),
    ]);
  },
});

export const setThreadPinned = authedMutation({
  args: {
    threadId: v.id("threads"),
    isPinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const thread = await ensureOwnedThread(ctx, ctx.ownerId, args.threadId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
      .collect();
    await Promise.all([
      ...messages
        .filter((message) => message.isPinned !== args.isPinned)
        .map((message) =>
          ctx.db.patch(message._id, {
            isPinned: args.isPinned,
            updatedAt: Date.now(),
          }),
        ),
      ctx.db.patch(thread._id, {
        isPinned: args.isPinned,
        updatedAt: Date.now(),
      }),
    ]);
  },
});

export const setThreadRead = authedMutation({
  args: {
    threadId: v.id("threads"),
    isRead: v.boolean(),
  },
  handler: async (ctx, args) => {
    const thread = await ensureOwnedThread(ctx, ctx.ownerId, args.threadId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
      .collect();
    const account = await ctx.db.get(thread.accountId);
    const now = Date.now();
    const changedMessages = messages.filter(
      (message) => message.isRead !== args.isRead,
    );
    await Promise.all([
      ...changedMessages.map(async (message) => {
        await ctx.db.patch(message._id, {
          isRead: args.isRead,
          updatedAt: now,
        });
      }),
      ctx.db.patch(thread._id, {
        unreadCount: args.isRead ? 0 : messages.length,
        updatedAt: now,
      }),
      ...changedMessages.flatMap((message, index) => {
        const update = scheduleProviderReadUpdate({
          ctx,
          account,
          message,
          isRead: args.isRead,
          delay: index * 100,
        });
        return update ? [update] : [];
      }),
    ]);
  },
});

export const archiveThread = authedMutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) =>
    await archiveOwnedThread(ctx, ctx.ownerId, args.threadId),
});

export const removeThreadFromRodge = authedMutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) =>
    await archiveOwnedThread(ctx, ctx.ownerId, args.threadId),
});

async function archiveOwnedThread(
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

export const enqueuePlainText = authedMutation({
  args: {
    accountId: v.id("mailAccounts"),
    idempotencyKey: v.string(),
    to: v.array(vMailboxAddress),
    cc: v.optional(v.array(vMailboxAddress)),
    bcc: v.optional(v.array(vMailboxAddress)),
    subject: v.string(),
    plainText: v.string(),
    replyToMessageId: v.optional(v.id("messages")),
    attachmentIds: v.optional(v.array(v.id("draftAttachments"))),
  },
  handler: async (ctx, args) => {
    const account = await ensureOwnedAccount(ctx, ctx.ownerId, args.accountId);
    const recipients = validateRecipientFields(args);
    const idempotencyKey = validateSendRequest(account, args);
    const existing = await ctx.db
      .query("outboxMessages")
      .withIndex("by_account_idempotency", (q) =>
        q.eq("accountId", args.accountId).eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (existing) {
      return getIdempotentEnqueueResult(existing, {
        attachmentIds: args.attachmentIds,
        bcc: recipients.bcc,
        cc: recipients.cc,
        plainText: args.plainText,
        replyToMessageId: args.replyToMessageId,
        subject: args.subject,
        to: recipients.to,
      });
    }

    const replyMessage = args.replyToMessageId
      ? await ensureOwnedMessage(ctx, ctx.ownerId, args.replyToMessageId)
      : undefined;
    const replyMetadata = replyMessage
      ? resolveReplyMetadata(replyMessage, ctx.ownerId, account._id)
      : {};
    const { attachmentIds, attachments } = await getReadyDraftAttachments(
      ctx,
      args.attachmentIds ?? [],
    );
    validateProviderAttachments(account, attachments);

    const now = Date.now();
    const outboxId = await ctx.db.insert("outboxMessages", {
      ownerId: ctx.ownerId,
      accountId: args.accountId,
      idempotencyKey,
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject: args.subject,
      plainText: args.plainText,
      ...replyMetadata,
      attachmentIds,
      status: "pending",
      attempt: 0,
      createdAt: now,
      updatedAt: now,
    });
    await Promise.all(
      attachments.map(async (attachment) => {
        await ctx.db.patch(attachment._id, {
          status: "claimed",
          outboxId,
          updatedAt: now,
        });
      }),
    );
    await ctx.scheduler.runAfter(
      0,
      internal.sync.internal.deliverProviderOutbox,
      { outboxId },
    );
    return { outboxId, reused: false, status: "pending" } as const;
  },
});

export const retryOutbox = authedMutation({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (!outbox || outbox.ownerId !== ctx.ownerId) {
      throw new ConvexError("Outbox message not found");
    }
    if (!canRetryOutbox(outbox)) {
      return { retried: false, status: outbox.status } as const;
    }
    await ctx.db.patch(outbox._id, getRetryOutboxUpdate(Date.now()));
    await ctx.scheduler.runAfter(
      0,
      internal.sync.internal.deliverProviderOutbox,
      { outboxId: outbox._id },
    );
    return { retried: true, status: "pending" } as const;
  },
});
