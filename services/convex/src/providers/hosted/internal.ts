import { v } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { internalMutation, internalQuery } from "../../_generated/server";
import { vMailboxAddress } from "../../mail/validators";
import { vHostedDeliveryEventType } from "./validators";
import { getActiveAccount } from "../../mail/helpers";

export const resolveRecipients = internalQuery({
  args: { recipients: v.array(v.string()) },
  handler: async (ctx, args) => {
    const resolved = new Map<
      Id<"mailAccounts">,
      { ownerId: string; accountId: Id<"mailAccounts">; address: string }
    >();
    for (const recipient of args.recipients) {
      const account = await findRecipientAccount(ctx, recipient);
      if (!account || resolved.has(account._id)) continue;
      resolved.set(account._id, {
        ownerId: account.ownerId,
        accountId: account._id,
        address: account.address,
      });
    }
    return [...resolved.values()];
  },
});

export const getOutboxContext = internalQuery({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (!outbox) return null;
    const account = await getActiveAccount(ctx, outbox.accountId);
    if (account?.provider !== "hosted" || account.ownerId !== outbox.ownerId) {
      return null;
    }
    return {
      displayName: account.displayName,
      ...(await getReplyContext(ctx, outbox)),
    };
  },
});

export const recordDeliveryEvent = internalMutation({
  args: {
    sesMessageId: v.string(),
    type: vHostedDeliveryEventType,
    recipients: v.array(vMailboxAddress),
    detail: v.optional(v.string()),
    occurredAt: v.number(),
  },
  handler: async (ctx, args) => {
    const outbox = await ctx.db
      .query("outboxMessages")
      .withIndex("by_remote_message", (q) =>
        q.eq("remoteMessageId", `ses:${args.sesMessageId}`),
      )
      .first();
    await ctx.db.insert("hostedDeliveryEvents", {
      ...args,
      ownerId: outbox?.ownerId,
      createdAt: Date.now(),
    });
  },
});

async function findRecipientAccount(ctx: QueryCtx, recipient: string) {
  const address = recipient.trim().toLowerCase();
  const hostedAddress = await ctx.db
    .query("hostedAddresses")
    .withIndex("by_address", (q) => q.eq("address", address))
    .unique();
  const accountId =
    hostedAddress?.accountId ??
    (await findCatchAllAccountId(ctx, address.split("@")[1] ?? ""));
  if (!accountId) return null;
  const account = await getActiveAccount(ctx, accountId);
  return account?.provider === "hosted" && account.status !== "disconnected"
    ? account
    : null;
}

async function findCatchAllAccountId(ctx: QueryCtx, domain: string) {
  const hostedDomain = await ctx.db
    .query("hostedDomains")
    .withIndex("by_domain", (q) => q.eq("domain", domain))
    .unique();
  return hostedDomain?.catchAllAccountId;
}

async function getReplyContext(ctx: QueryCtx, outbox: Doc<"outboxMessages">) {
  if (!outbox.replyToMessageId) return { references: [] };
  const message = await ctx.db.get(outbox.replyToMessageId);
  if (message?.ownerId !== outbox.ownerId) return { references: [] };
  const thread = await ctx.db.get(message.threadId);
  return {
    replyRemoteThreadId: thread?.remoteThreadId,
    references: replyReferences(message),
  };
}

function replyReferences(message: Doc<"messages">) {
  const header = message.headers?.find(
    (item) => item.name.toLowerCase() === "references",
  );
  const references = header?.value.split(/\s+/u).filter(Boolean) ?? [];
  return message.internetMessageId
    ? [...references, message.internetMessageId]
    : references;
}
