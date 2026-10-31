import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { internalMutation, internalQuery } from "../../_generated/server";
import { env } from "../../convex.env";
import { resolveReplyMetadata } from "../../mail/replies";
import { normalizeHostedAddress, normalizeHostedDomain } from "./addresses";

export const registerDomain = internalMutation({
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    const ownerId = env.AUTH_ALLOWED_USER_ID;
    const domain = normalizeHostedDomain(args.domain);
    const existing = await ctx.db
      .query("hostedDomains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .unique();
    if (existing) {
      if (existing.ownerId !== ownerId) {
        throw new Error(`${domain} belongs to another owner`);
      }
      return { domain, created: false };
    }
    const now = Date.now();
    await ctx.db.insert("hostedDomains", {
      ownerId,
      domain,
      createdAt: now,
      updatedAt: now,
    });
    return { domain, created: true };
  },
});

export const createAddress = internalMutation({
  args: {
    address: v.string(),
    displayName: v.optional(v.string()),
    aliasOf: v.optional(v.string()),
    catchAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const ownerId = env.AUTH_ALLOWED_USER_ID;
    const { address, domain } = normalizeHostedAddress(args.address);
    const hostedDomain = await ctx.db
      .query("hostedDomains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .unique();
    if (hostedDomain?.ownerId !== ownerId) {
      throw new Error(`Register ${domain} with add-domain first`);
    }
    const existing = await ctx.db
      .query("hostedAddresses")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
    if (existing) {
      return { address, accountId: existing.accountId, created: false };
    }
    const now = Date.now();
    let accountId;
    if (args.aliasOf) {
      const target = await ctx.db
        .query("hostedAddresses")
        .withIndex("by_address", (q) =>
          q.eq("address", normalizeHostedAddress(args.aliasOf ?? "").address),
        )
        .unique();
      if (target?.ownerId !== ownerId) {
        throw new Error(`${args.aliasOf} is not a hosted address`);
      }
      accountId = target.accountId;
    } else {
      accountId = await ctx.db.insert("mailAccounts", {
        ownerId,
        provider: "hosted",
        remoteAccountId: address,
        address,
        displayName: optionalText(args.displayName),
        status: "connected",
        connectedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("hostedAddresses", {
      ownerId,
      accountId,
      address,
      domain,
      createdAt: now,
    });
    if (args.catchAll) {
      await ctx.db.patch(hostedDomain._id, {
        catchAllAccountId: accountId,
        updatedAt: now,
      });
    }
    return { address, accountId, created: true };
  },
});

export const listAddresses = internalQuery({
  args: {},
  handler: async (ctx) => {
    const ownerId = env.AUTH_ALLOWED_USER_ID;
    const [domains, addresses] = await Promise.all([
      ctx.db
        .query("hostedDomains")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("hostedAddresses")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect(),
    ]);
    return domains.map((domain) => ({
      domain: domain.domain,
      catchAllAccountId: domain.catchAllAccountId,
      addresses: addresses
        .filter((address) => address.domain === domain.domain)
        .map((address) => ({
          address: address.address,
          accountId: address.accountId,
        })),
    }));
  },
});

function optionalText(value: string | undefined) {
  const text = value?.trim();
  if (!text) return undefined;
  return text;
}

export const sendTestMessage = internalMutation({
  args: {
    from: v.string(),
    to: v.string(),
    replyToInternetMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = env.AUTH_ALLOWED_USER_ID;
    const from = normalizeHostedAddress(args.from).address;
    const account = await ctx.db
      .query("mailAccounts")
      .withIndex("by_owner_address", (q) =>
        q.eq("ownerId", ownerId).eq("address", from),
      )
      .first();
    if (!account) throw new Error(`${from} is not a connected account`);
    const reply = args.replyToInternetMessageId
      ? await findAccountMessage(
          ctx,
          account._id,
          args.replyToInternetMessageId,
        )
      : null;
    const now = Date.now();
    const outboxId = await ctx.db.insert("outboxMessages", {
      ownerId,
      accountId: account._id,
      idempotencyKey: `hosted-test:${now}`,
      to: [{ address: normalizeHostedAddress(args.to).address }],
      cc: [],
      bcc: [],
      subject: reply
        ? `Re: ${reply.subject.replace(/^re:\s*/iu, "")}`
        : `Rodge hosted mail test ${new Date(now).toISOString()}`,
      plainText: `This test was sent from ${from} at ${new Date(now).toISOString()}.`,
      ...(reply ? resolveReplyMetadata(reply, ownerId, account._id) : {}),
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
    return { outboxId, accountProvider: account.provider, isReply: !!reply };
  },
});

async function findAccountMessage(
  ctx: MutationCtx,
  accountId: Id<"mailAccounts">,
  internetMessageId: string,
) {
  const recent = await ctx.db
    .query("messages")
    .withIndex("by_account_received", (q) => q.eq("accountId", accountId))
    .order("desc")
    .take(200);
  const message = recent.find((item) =>
    item.internetMessageId?.includes(internetMessageId),
  );
  if (!message) throw new Error("The message to reply to was not found");
  return message;
}
