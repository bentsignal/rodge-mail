import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { getClassificationForMessage } from "../mail/helpers";
import { getMailingListInfo, messageMatchesSuppression } from "./policy";
import { suppressMessageAsSpam } from "./suppression";
import { vMailingListRemoteStatus } from "./validators";

export const beginUnsubscribe = internalMutation({
  args: { ownerId: v.string(), messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.ownerId !== args.ownerId) {
      throw new ConvexError("Message not found");
    }
    const classification = await getClassificationForMessage(ctx, message._id);
    const info = getMailingListInfo(message, classification?.category);
    if (!info) throw new ConvexError("This message is not a mailing list");

    const existing = info.listId
      ? await ctx.db
          .query("mailingListSuppressions")
          .withIndex("by_account_list", (q) =>
            q.eq("accountId", message.accountId).eq("listId", info.listId),
          )
          .first()
      : await ctx.db
          .query("mailingListSuppressions")
          .withIndex("by_account_sender", (q) =>
            q
              .eq("accountId", message.accountId)
              .eq("senderAddress", info.senderAddress),
          )
          .first();
    const now = Date.now();
    const values = {
      ownerId: args.ownerId,
      accountId: message.accountId,
      sourceMessageId: message._id,
      senderAddress: info.senderAddress,
      listId: info.listId,
      displayName: info.displayName.slice(0, 160),
      remoteMethod: info.remoteMethod,
      remoteStatus:
        info.remoteMethod === "none"
          ? ("unavailable" as const)
          : ("pending" as const),
      remoteError: undefined,
      disabledAt: undefined,
      updatedAt: now,
    };
    const suppressionId = existing
      ? existing._id
      : await ctx.db.insert("mailingListSuppressions", {
          ...values,
          createdAt: now,
        });
    if (existing) await ctx.db.patch(existing._id, values);
    await suppressMessageAsSpam(ctx, message, suppressionId, now);
    await ctx.scheduler.runAfter(
      0,
      internal.mailingLists.internal.applySuppressionPage,
      {
        ownerId: args.ownerId,
        suppressionId,
        paginationOpts: { cursor: null, numItems: 50 },
      },
    );
    return {
      displayName: info.displayName,
      mailto: info.mailto,
      oneClickUrl: info.oneClickUrl,
      remoteMethod: info.remoteMethod,
      suppressionId,
    };
  },
});

export const applySuppressionPage = internalMutation({
  args: {
    ownerId: v.string(),
    suppressionId: v.id("mailingListSuppressions"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const suppression = await ctx.db.get(args.suppressionId);
    if (
      !suppression ||
      suppression.ownerId !== args.ownerId ||
      suppression.disabledAt
    ) {
      return;
    }
    const page = await ctx.db
      .query("messages")
      .withIndex("by_account_received", (q) =>
        q.eq("accountId", suppression.accountId),
      )
      .paginate(args.paginationOpts);
    for (const message of page.page) {
      if (!message.inInbox || message.direction !== "incoming") continue;
      const classification = await getClassificationForMessage(
        ctx,
        message._id,
      );
      if (
        messageMatchesSuppression(
          message,
          classification?.category,
          suppression,
        )
      ) {
        await suppressMessageAsSpam(ctx, message, suppression._id);
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.mailingLists.internal.applySuppressionPage,
        {
          ownerId: args.ownerId,
          suppressionId: suppression._id,
          paginationOpts: {
            cursor: page.continueCursor,
            numItems: args.paginationOpts.numItems,
          },
        },
      );
    }
  },
});

export const queueUnsubscribeEmail = internalMutation({
  args: {
    ownerId: v.string(),
    suppressionId: v.id("mailingListSuppressions"),
    address: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const suppression = await ctx.db.get(args.suppressionId);
    if (!suppression || suppression.ownerId !== args.ownerId) {
      throw new ConvexError("Mailing-list suppression not found");
    }
    const idempotencyKey = `unsubscribe:${suppression._id}`;
    const existing = await ctx.db
      .query("outboxMessages")
      .withIndex("by_account_idempotency", (q) =>
        q
          .eq("accountId", suppression.accountId)
          .eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (existing) return existing._id;
    const now = Date.now();
    const outboxId = await ctx.db.insert("outboxMessages", {
      ownerId: args.ownerId,
      accountId: suppression.accountId,
      idempotencyKey,
      to: [{ address: args.address }],
      cc: [],
      bcc: [],
      subject: args.subject,
      plainText: args.body,
      attachmentIds: [],
      status: "pending",
      attempt: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.sync.internal.deliverProviderOutbox,
      { outboxId },
    );
    return outboxId;
  },
});

export const completeRemoteAttempt = internalMutation({
  args: {
    ownerId: v.string(),
    suppressionId: v.id("mailingListSuppressions"),
    status: vMailingListRemoteStatus,
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const suppression = await ctx.db.get(args.suppressionId);
    if (!suppression || suppression.ownerId !== args.ownerId) return;
    await ctx.db.patch(suppression._id, {
      remoteStatus: args.status,
      remoteError: args.error?.slice(0, 240),
      updatedAt: Date.now(),
    });
  },
});
