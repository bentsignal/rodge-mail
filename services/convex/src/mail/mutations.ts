import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { AuthedMutationCtx } from "../utils";
import { internal } from "../_generated/api";
import { authedMutation } from "../utils";
import {
  ensureOwnedAccount,
  ensureOwnedMessage,
  ensureOwnedThread,
} from "./helpers";
import {
  attachmentIdsMatch,
  getReadyDraftAttachments,
  validateProviderAttachments,
  validateSendRequest,
} from "./outbox";
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
    await Promise.all(
      messages.map(async (message) => {
        if (message.isPinned !== args.isPinned) {
          await ctx.db.patch(message._id, {
            isPinned: args.isPinned,
            updatedAt: Date.now(),
          });
        }
      }),
    );
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

function scheduleProviderReadUpdate({
  ctx,
  account,
  message,
  isRead,
  delay,
}: {
  ctx: AuthedMutationCtx;
  account: Doc<"mailAccounts"> | null;
  message: Doc<"messages">;
  isRead: boolean;
  delay: number;
}) {
  if (!account || account.ownerId !== ctx.ownerId || account.isDemo) {
    return undefined;
  }
  const args = {
    ownerId: ctx.ownerId,
    accountId: account._id,
    remoteMessageId: message.remoteMessageId,
    isRead,
  };
  if (account.provider === "gmail") {
    return ctx.scheduler.runAfter(
      delay,
      internal.sync.internal.setGmailMessageRead,
      args,
    );
  }
  if (account.provider === "microsoft") {
    return ctx.scheduler.runAfter(
      delay,
      internal.sync.internal.setMicrosoftMessageRead,
      args,
    );
  }
  return ctx.scheduler.runAfter(
    delay,
    internal.providers.icloud.outbox.setRead,
    args,
  );
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
    replyToInternetMessageId: v.optional(v.string()),
    attachmentIds: v.optional(v.array(v.id("draftAttachments"))),
  },
  handler: async (ctx, args) => {
    const account = await ensureOwnedAccount(ctx, ctx.ownerId, args.accountId);
    const idempotencyKey = validateSendRequest(account, args);
    const { attachmentIds, attachments } = await getReadyDraftAttachments(
      ctx,
      args.attachmentIds ?? [],
    );
    validateProviderAttachments(account, attachments);
    const existing = await ctx.db
      .query("outboxMessages")
      .withIndex("by_account_idempotency", (q) =>
        q.eq("accountId", args.accountId).eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (existing) {
      if (!attachmentIdsMatch(existing.attachmentIds ?? [], attachmentIds)) {
        throw new ConvexError(
          "This send attempt already exists with different attachments",
        );
      }
      return existing._id;
    }

    const now = Date.now();
    const outboxId = await ctx.db.insert("outboxMessages", {
      ownerId: ctx.ownerId,
      accountId: args.accountId,
      idempotencyKey,
      to: args.to,
      cc: args.cc ?? [],
      bcc: args.bcc ?? [],
      subject: args.subject,
      plainText: args.plainText,
      replyToInternetMessageId: args.replyToInternetMessageId,
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
    return outboxId;
  },
});

export const retryOutbox = authedMutation({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (!outbox || outbox.ownerId !== ctx.ownerId) {
      throw new ConvexError("Outbox message not found");
    }
    if (outbox.status !== "failed") return;
    await ctx.db.patch(outbox._id, {
      status: "pending",
      error: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.sync.internal.deliverProviderOutbox,
      { outboxId: outbox._id },
    );
  },
});
