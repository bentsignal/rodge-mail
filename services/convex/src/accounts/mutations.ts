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
    if (
      account.status === "disconnected" ||
      account.status === "reauthorization_required"
    ) {
      throw new ConvexError("Reconnect iCloud before syncing");
    }
    await ctx.scheduler.runAfter(
      0,
      internal.providers.icloud.sync.synchronize,
      {
        ownerId: ctx.ownerId,
        accountId: args.accountId,
        reason: "manual",
      },
    );
  },
});

export const syncAllNow = authedMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db
      .query("mailAccounts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
      .collect();
    const syncable = accounts.filter(
      (account) =>
        !account.isDemo &&
        account.status !== "disconnected" &&
        account.status !== "reauthorization_required",
    );

    await Promise.all(
      syncable.map(async (account, index) => {
        const args = {
          ownerId: ctx.ownerId,
          accountId: account._id,
          reason: "manual" as const,
        };
        const delay = index * 100;
        if (account.provider === "gmail") {
          await ctx.scheduler.runAfter(
            delay,
            internal.sync.internal.executeGmailSync,
            args,
          );
          return;
        }
        if (account.provider === "microsoft") {
          await ctx.scheduler.runAfter(
            delay,
            internal.sync.internal.executeMicrosoftSync,
            args,
          );
          return;
        }
        await ctx.scheduler.runAfter(
          delay,
          internal.providers.icloud.sync.synchronize,
          args,
        );
      }),
    );

    return {
      scheduled: syncable.length,
      skipped: accounts.length - syncable.length,
    };
  },
});
