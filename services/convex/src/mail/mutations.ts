import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { AuthedMutationCtx } from "../utils";
import { internal } from "../_generated/api";
import {
  MAX_ATTACHMENT_COUNT,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from "../attachments/constants";
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

    const account = await ctx.db.get(message.accountId);

    await Promise.all([
      ctx.db.patch(message._id, {
        isRead: args.isRead,
        updatedAt: Date.now(),
      }),
      ctx.db.patch(thread._id, {
        unreadCount: Math.max(0, thread.unreadCount + (args.isRead ? -1 : 1)),
        updatedAt: Date.now(),
      }),
      ...(account?.ownerId === ctx.ownerId && account.provider === "microsoft"
        ? [
            ctx.scheduler.runAfter(
              0,
              internal.sync.internal.setMicrosoftMessageRead,
              {
                ownerId: ctx.ownerId,
                accountId: account._id,
                remoteMessageId: message.remoteMessageId,
                isRead: args.isRead,
              },
            ),
          ]
        : []),
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
    const account = await ctx.db.get(thread.accountId);
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
      ...(account?.ownerId === ctx.ownerId && account.provider === "microsoft"
        ? messages
            .filter((message) => message.isRead !== args.isRead)
            .map((message, index) =>
              ctx.scheduler.runAfter(
                index * 100,
                internal.sync.internal.setMicrosoftMessageRead,
                {
                  ownerId: ctx.ownerId,
                  accountId: account._id,
                  remoteMessageId: message.remoteMessageId,
                  isRead: args.isRead,
                },
              ),
            )
        : []),
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

function validateSendRequest(
  account: Doc<"mailAccounts">,
  args: {
    idempotencyKey: string;
    plainText: string;
    to: { address: string; name?: string }[];
    attachmentIds?: Id<"draftAttachments">[];
  },
) {
  if (
    !["gmail", "microsoft"].includes(account.provider) ||
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
  return idempotencyKey;
}

function validateProviderAttachments(
  account: Doc<"mailAccounts">,
  attachments: Doc<"draftAttachments">[],
) {
  if (account.provider === "microsoft") {
    if (attachments.some((attachment) => (attachment.size ?? 0) > 3_145_728)) {
      throw new ConvexError(
        "Microsoft 365 attachments must be 3 MB or smaller",
      );
    }
    return;
  }
  if (account.provider !== "gmail" && attachments.length > 0) {
    throw new ConvexError(
      "Attachments are not yet available for the selected provider",
    );
  }
}

async function getReadyDraftAttachments(
  ctx: AuthedMutationCtx,
  requestedIds: Id<"draftAttachments">[],
) {
  const attachmentIds = [...new Set(requestedIds)];
  if (attachmentIds.length !== requestedIds.length) {
    throw new ConvexError("Duplicate attachments are not allowed");
  }
  if (attachmentIds.length > MAX_ATTACHMENT_COUNT) {
    throw new ConvexError("A message can include up to 5 attachments");
  }
  const documents = await Promise.all(
    attachmentIds.map(async (attachmentId) => {
      return await ctx.db.get(attachmentId);
    }),
  );
  const attachments = documents.flatMap((attachment) =>
    getReadyOwnedAttachment(attachment, ctx.ownerId),
  );
  if (attachments.length !== attachmentIds.length) {
    throw new ConvexError("Every attachment must finish uploading first");
  }
  const totalBytes = attachments.reduce(
    (total, attachment) => total + (attachment.size ?? 0),
    0,
  );
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new ConvexError("Attachments must total 18 MB or less");
  }
  return { attachmentIds, attachments };
}

function getReadyOwnedAttachment(
  attachment: Doc<"draftAttachments"> | null,
  ownerId: string,
) {
  if (attachment?.ownerId !== ownerId) return [];
  if (attachment.status !== "ready") return [];
  if (!attachment.storageId || attachment.size === undefined) return [];
  return [attachment];
}

function attachmentIdsMatch(
  existingIds: Id<"draftAttachments">[],
  requestedIds: Id<"draftAttachments">[],
) {
  return (
    existingIds.length === requestedIds.length &&
    existingIds.every((attachmentId) => requestedIds.includes(attachmentId))
  );
}

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
