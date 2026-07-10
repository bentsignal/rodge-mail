import { ConvexError, v } from "convex/values";

import { internalMutation, internalQuery } from "../../_generated/server";

export const upsertAccount = internalMutation({
  args: {
    ownerId: v.string(),
    address: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mailAccounts")
      .withIndex("by_owner_provider_remote", (q) =>
        q
          .eq("ownerId", args.ownerId)
          .eq("provider", "icloud")
          .eq("remoteAccountId", args.address),
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        address: args.address,
        displayName: args.displayName,
        grantedScopes: ["imap", "smtp"],
        lastSyncError: undefined,
        status: "syncing",
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("mailAccounts", {
      ownerId: args.ownerId,
      provider: "icloud",
      remoteAccountId: args.address,
      address: args.address,
      displayName: args.displayName,
      status: "syncing",
      grantedScopes: ["imap", "smtp"],
      connectedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getConnection = internalQuery({
  args: { ownerId: v.string(), accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (
      !account ||
      account.ownerId !== args.ownerId ||
      account.provider !== "icloud"
    ) {
      return null;
    }
    const credential = await ctx.db
      .query("providerCredentials")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .unique();
    return credential ? { account, credential } : null;
  },
});

export const markReauthorizationRequired = internalMutation({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (account?.ownerId !== args.ownerId || account.provider !== "icloud") {
      throw new ConvexError("iCloud account not found");
    }
    await ctx.db.patch(account._id, {
      status: "reauthorization_required",
      lastSyncError: args.error,
      updatedAt: Date.now(),
    });
  },
});

export const listScheduledAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("mailAccounts").collect();
    const cutoff = Date.now() - 4 * 60 * 1_000;
    return accounts
      .filter(
        (account) =>
          account.provider === "icloud" &&
          !account.isDemo &&
          ["connected", "error"].includes(account.status) &&
          (account.lastSyncedAt ?? 0) < cutoff,
      )
      .map((account) => ({
        ownerId: account.ownerId,
        accountId: account._id,
      }));
  },
});
