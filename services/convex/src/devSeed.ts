import { ConvexError } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { env } from "./convex.env";
import { DEMO_ACCOUNTS, DEMO_MESSAGES } from "./devSeedFixtures";
import {
  deleteDemoAccountRecords,
  ensureDemoAccount,
  ensureDemoMessage,
} from "./devSeedWrites";
import { authedMutation } from "./utils";

export const seedDemoMail = authedMutation({
  args: {},
  handler: async (ctx) => {
    ensureDevelopment();
    const accountIds = new Map<
      (typeof DEMO_ACCOUNTS)[number]["key"],
      Id<"mailAccounts">
    >();
    for (const account of DEMO_ACCOUNTS) {
      accountIds.set(
        account.key,
        await ensureDemoAccount(ctx, ctx.ownerId, account),
      );
    }

    let insertedMessages = 0;
    for (const fixture of DEMO_MESSAGES) {
      const accountId = accountIds.get(fixture.account);
      if (!accountId) throw new ConvexError("Demo account not found");
      insertedMessages += await ensureDemoMessage(
        ctx,
        ctx.ownerId,
        accountId,
        fixture,
      );
    }

    return {
      accountCount: accountIds.size,
      insertedMessages,
      totalMessages: DEMO_MESSAGES.length,
    };
  },
});

export const wipeDemoMail = authedMutation({
  args: {},
  handler: async (ctx) => {
    ensureDevelopment();
    const accounts = (
      await ctx.db
        .query("mailAccounts")
        .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
        .collect()
    ).filter(isDemoAccount);

    for (const account of accounts) {
      await deleteDemoAccountRecords(ctx, account._id);
    }
    return { deletedAccounts: accounts.length };
  },
});

function ensureDevelopment() {
  if (env.ENVIRONMENT === "production") {
    throw new ConvexError("Demo mail is unavailable in production");
  }
}

function isDemoAccount(account: { isDemo?: boolean; remoteAccountId: string }) {
  return (
    account.isDemo === true ||
    DEMO_ACCOUNTS.some(
      (fixture) => fixture.remoteAccountId === account.remoteAccountId,
    )
  );
}
