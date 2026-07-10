import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";

const DRAFT_RETENTION_MS = 24 * 60 * 60 * 1000;

export const getDownloadContext = internalQuery({
  args: { ownerId: v.string(), attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment || attachment.ownerId !== args.ownerId) return null;
    const message = await ctx.db.get(attachment.messageId);
    if (!message || message.ownerId !== args.ownerId) return null;
    const account = await ctx.db.get(message.accountId);
    if (!account || account.ownerId !== args.ownerId) return null;
    const credential = await ctx.db
      .query("providerCredentials")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .unique();
    return { account, attachment, credential, message };
  },
});

export const commitDownloadedFile = internalMutation({
  args: {
    ownerId: v.string(),
    attachmentId: v.id("attachments"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment || attachment.ownerId !== args.ownerId) return null;
    if (attachment.storageId) return attachment.storageId;
    await ctx.db.patch(attachment._id, {
      status: "available",
      storageId: args.storageId,
      updatedAt: Date.now(),
    });
    return args.storageId;
  },
});

export const markDownloadFailed = internalMutation({
  args: { ownerId: v.string(), attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment || attachment.ownerId !== args.ownerId) return;
    await ctx.db.patch(attachment._id, {
      status: "error",
      updatedAt: Date.now(),
    });
  },
});

export const cleanupExpiredDrafts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - DRAFT_RETENTION_MS;
    const expired = (
      await Promise.all(
        (["pending", "ready"] as const).map(async (status) => {
          return await ctx.db
            .query("draftAttachments")
            .withIndex("by_status_created", (q) =>
              q.eq("status", status).lt("createdAt", cutoff),
            )
            .take(50);
        }),
      )
    ).flat();
    for (const attachment of expired) {
      if (attachment.status === "claimed") continue;
      if (attachment.storageId) await ctx.storage.delete(attachment.storageId);
      await ctx.db.delete(attachment._id);
    }
  },
});
