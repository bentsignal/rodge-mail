import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { ensureOwnedAccount } from "../mail/helpers";
import { authedMutation } from "../utils";

export const syncGmailNow = authedMutation({
  args: { accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ensureOwnedAccount(ctx, ctx.ownerId, args.accountId);
    if (account.provider !== "gmail" || account.isDemo) {
      throw new ConvexError("Gmail sync is unavailable for this account");
    }
    if (
      account.status === "disconnected" ||
      account.status === "reauthorization_required"
    ) {
      throw new ConvexError("Reconnect Gmail before syncing");
    }
    await ctx.scheduler.runAfter(0, internal.sync.internal.executeGmailSync, {
      ownerId: ctx.ownerId,
      accountId: args.accountId,
      reason: "manual",
    });
  },
});

export const syncMicrosoftNow = authedMutation({
  args: { accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ensureOwnedAccount(ctx, ctx.ownerId, args.accountId);
    if (account.provider !== "microsoft" || account.isDemo) {
      throw new ConvexError("Microsoft sync is unavailable for this account");
    }
    if (
      account.status === "disconnected" ||
      account.status === "reauthorization_required"
    ) {
      throw new ConvexError("Reconnect Microsoft before syncing");
    }
    await ctx.scheduler.runAfter(
      0,
      internal.sync.internal.executeMicrosoftSync,
      {
        ownerId: ctx.ownerId,
        accountId: args.accountId,
        reason: "manual",
      },
    );
  },
});

export const syncICloudNow = authedMutation({
  args: { accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ensureOwnedAccount(ctx, ctx.ownerId, args.accountId);
    if (account.provider !== "icloud" || account.isDemo) {
      throw new ConvexError("iCloud sync is unavailable for this account");
    }
    if (account.status === "disconnected") {
      throw new ConvexError("Reconnect iCloud before syncing");
    }
    await ctx.scheduler.runAfter(
      0,
      internal.providers.icloud.internal.enqueueSyncJob,
      {
        ownerId: ctx.ownerId,
        accountId: args.accountId,
        reason: "manual",
      },
    );
  },
});
