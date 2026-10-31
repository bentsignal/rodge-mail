import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { createAuth } from "./auth";
import { env } from "./convex.env";
import { bulkMailbox } from "./devSeedBulk";
import {
  ISOLATED_ACCOUNTS,
  ISOLATED_OWNER_NAME,
  isolatedMailbox,
} from "./devSeedMailbox";
import { seedSentMail } from "./devSeedSent";
import {
  deleteDemoAccountRecords,
  ensureDemoAccount,
  ensureDemoMessage,
} from "./devSeedWrites";
import { requireDevTools } from "./devSignIn";
import { DEV_USER_EMAIL } from "./devToolsPolicy";

/**
 * Isolated backends only (`scripts/backend.sh isolate`): the test owner the
 * simulator signs in as. Written through the raw adapter because
 * `privateAccountHooks` closes registration; the script then makes the
 * returned id `AUTH_ALLOWED_USER_ID`.
 */
export const ensureOwner = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireDevTools();
    const { adapter } = await createAuth(ctx).$context;
    const existing = await adapter.findOne<{ id: string }>({
      model: "user",
      where: [{ field: "email", value: DEV_USER_EMAIL }],
    });
    if (existing) return existing.id;
    const now = new Date();
    const user = await adapter.create<Record<string, unknown>, { id: string }>({
      model: "user",
      data: {
        createdAt: now,
        email: DEV_USER_EMAIL,
        emailVerified: true,
        name: ISOLATED_OWNER_NAME,
        updatedAt: now,
      },
    });
    return user.id;
  },
});

/**
 * Replaces the test owner's seeded mailbox with a fresh one dated now, plus
 * `bulkThreads` older filler threads for paging through a long inbox.
 */
export const seed = internalMutation({
  args: { bulkThreads: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requireDevTools();
    const ownerId = env.AUTH_ALLOWED_USER_ID;
    const existing = await ctx.db
      .query("mailAccounts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    for (const account of existing) {
      if (account.isDemo === true) {
        await deleteDemoAccountRecords(ctx, account._id);
      }
    }

    const accountIds = new Map<string, Id<"mailAccounts">>();
    for (const account of ISOLATED_ACCOUNTS) {
      accountIds.set(
        account.key,
        await ensureDemoAccount(ctx, ownerId, account),
      );
    }
    let messages = 0;
    const now = Date.now();
    for (const fixture of [
      ...isolatedMailbox(now),
      ...bulkMailbox(now, args.bulkThreads ?? 0),
    ]) {
      const accountId = accountIds.get(fixture.account);
      if (!accountId) throw new ConvexError("Seed account not found");
      messages += await ensureDemoMessage(ctx, ownerId, accountId, fixture);
    }
    await seedSentMail(ctx, ownerId, accountIds, Date.now());
    return { accounts: accountIds.size, messages };
  },
});
