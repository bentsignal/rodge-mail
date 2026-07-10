import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { reconcileEmbeddingSelection } from "../embedding/internal";
import { authedMutation } from "../utils";
import {
  ensureOwnedAccount,
  ensureOwnedMessage,
  ensureOwnedThread,
} from "./helpers";
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
    await reconcileEmbeddingSelection(ctx, message._id);
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
        await reconcileEmbeddingSelection(ctx, message._id);
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
    const now = Date.now();
    await Promise.all([
      ...messages
        .filter((message) => message.isRead !== args.isRead)
        .map(async (message) => {
          await ctx.db.patch(message._id, {
            isRead: args.isRead,
            updatedAt: now,
          });
        }),
      ctx.db.patch(thread._id, {
        unreadCount: args.isRead ? 0 : messages.length,
        updatedAt: now,
      }),
    ]);
  },
});

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
  },
  handler: async (ctx, args) => {
    const account = await ensureOwnedAccount(ctx, ctx.ownerId, args.accountId);
    if (
      account.provider !== "gmail" ||
      !["connected", "syncing"].includes(account.status)
    ) {
      throw new ConvexError("The selected account cannot send mail");
    }
    const idempotencyKey = args.idempotencyKey.trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      throw new ConvexError("A stable idempotency key is required");
    }
    if (args.to.length === 0 || !args.plainText.trim()) {
      throw new ConvexError("A recipient and message body are required");
    }
    const existing = await ctx.db
      .query("outboxMessages")
      .withIndex("by_account_idempotency", (q) =>
        q.eq("accountId", args.accountId).eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (existing) return existing._id;

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
      status: "pending",
      attempt: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.sync.internal.deliverGmailOutbox, {
      outboxId,
    });
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
    await ctx.scheduler.runAfter(0, internal.sync.internal.deliverGmailOutbox, {
      outboxId: outbox._id,
    });
  },
});
