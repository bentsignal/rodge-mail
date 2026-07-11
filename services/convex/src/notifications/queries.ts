import { v } from "convex/values";

import type { QueryCtx } from "../_generated/server";
import { ensureOwnedAccount } from "../mail/helpers";
import { authedQuery } from "../utils";
import { resolveNotificationPreferences } from "./preferences";

async function getGlobalPreferences(ctx: QueryCtx, ownerId: string) {
  return await ctx.db
    .query("notificationPreferences")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
}

function toAccountPreferences(
  globalPreference: Awaited<ReturnType<typeof getGlobalPreferences>>,
  accountPreference: {
    includePreview?: boolean;
    newMailEnabled?: boolean;
  } | null,
) {
  return {
    override: {
      newMailEnabled: accountPreference?.newMailEnabled ?? null,
      includePreview: accountPreference?.includePreview ?? null,
    },
    effective: resolveNotificationPreferences(
      globalPreference,
      accountPreference,
    ),
  };
}

export const getPreferences = authedQuery({
  args: {},
  handler: async (ctx) => {
    const preference = await getGlobalPreferences(ctx, ctx.ownerId);
    return resolveNotificationPreferences(preference, null);
  },
});

export const getAccountPreferences = authedQuery({
  args: { accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    await ensureOwnedAccount(ctx, ctx.ownerId, args.accountId);
    const [globalPreference, accountPreference] = await Promise.all([
      getGlobalPreferences(ctx, ctx.ownerId),
      ctx.db
        .query("accountNotificationPreferences")
        .withIndex("by_owner_account", (q) =>
          q.eq("ownerId", ctx.ownerId).eq("accountId", args.accountId),
        )
        .unique(),
    ]);
    return {
      accountId: args.accountId,
      ...toAccountPreferences(globalPreference, accountPreference),
    };
  },
});

export const listAccountPreferences = authedQuery({
  args: {},
  handler: async (ctx) => {
    const [accounts, globalPreference, accountPreferences] = await Promise.all([
      ctx.db
        .query("mailAccounts")
        .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
        .collect(),
      getGlobalPreferences(ctx, ctx.ownerId),
      ctx.db
        .query("accountNotificationPreferences")
        .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
        .collect(),
    ]);
    const preferencesByAccount = new Map(
      accountPreferences.map((preference) => [
        preference.accountId,
        preference,
      ]),
    );
    return accounts.map((account) => ({
      accountId: account._id,
      address: account.address,
      displayName: account.displayName,
      provider: account.provider,
      ...toAccountPreferences(
        globalPreference,
        preferencesByAccount.get(account._id) ?? null,
      ),
    }));
  },
});
