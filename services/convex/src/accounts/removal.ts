import { v } from "convex/values";

import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

export const REMOVAL_MESSAGE_BATCH_SIZE = 20;
export const REMOVAL_ROW_BATCH_SIZE = 200;
export const REMOVAL_OUTBOX_BATCH_SIZE = 50;

type Account = Doc<"mailAccounts">;
type RemovalStep = (ctx: MutationCtx, account: Account) => Promise<boolean>;

/**
 * Hides the account everywhere right away and drops its inbound routes, then
 * hands the row deletion to `removeAccountBatch`.
 */
export async function startAccountRemoval(ctx: MutationCtx, account: Account) {
  const now = Date.now();
  await ctx.db.patch(account._id, { deletingAt: now, updatedAt: now });
  await deleteHostedRoutes(ctx, account);
  await ctx.scheduler.runAfter(
    0,
    internal.accounts.removal.removeAccountBatch,
    {
      accountId: account._id,
    },
  );
}

export const removeAccountBatch = internalMutation({
  args: { accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (account?.deletingAt === undefined) return { done: true };
    for (const step of REMOVAL_STEPS) {
      if (await step(ctx, account)) {
        await ctx.scheduler.runAfter(
          0,
          internal.accounts.removal.removeAccountBatch,
          args,
        );
        return { done: false };
      }
    }
    await ctx.db.delete(account._id);
    return { done: true };
  },
});

/** Each step deletes one bounded batch and returns whether it found any rows. */
const REMOVAL_STEPS = [
  deleteMessages,
  async (ctx, account) =>
    await deleteRows(
      ctx,
      await ctx.db
        .query("threads")
        .withIndex("by_account_latest", (q) => q.eq("accountId", account._id))
        .take(REMOVAL_ROW_BATCH_SIZE),
    ),
  async (ctx, account) =>
    await deleteRows(
      ctx,
      await ctx.db
        .query("mailFolders")
        .withIndex("by_account_kind", (q) => q.eq("accountId", account._id))
        .take(REMOVAL_ROW_BATCH_SIZE),
    ),
  async (ctx, account) =>
    await deleteRows(
      ctx,
      await ctx.db
        .query("archivedMessageTombstones")
        .withIndex("by_account_remote", (q) => q.eq("accountId", account._id))
        .take(REMOVAL_ROW_BATCH_SIZE),
    ),
  async (ctx, account) =>
    await deleteRows(
      ctx,
      await ctx.db
        .query("mailingListSuppressions")
        .withIndex("by_account_list", (q) => q.eq("accountId", account._id))
        .take(REMOVAL_ROW_BATCH_SIZE),
    ),
  deleteOutbox,
  async (ctx, account) =>
    await deleteRows(
      ctx,
      await ctx.db
        .query("syncRuns")
        .withIndex("by_account_created", (q) => q.eq("accountId", account._id))
        .take(REMOVAL_ROW_BATCH_SIZE),
    ),
  async (ctx, account) =>
    await deleteRows(
      ctx,
      await ctx.db
        .query("providerCredentials")
        .withIndex("by_account", (q) => q.eq("accountId", account._id))
        .take(REMOVAL_ROW_BATCH_SIZE),
    ),
  async (ctx, account) =>
    await deleteRows(
      ctx,
      await ctx.db
        .query("accountNotificationPreferences")
        .withIndex("by_owner_account", (q) =>
          q.eq("ownerId", account.ownerId).eq("accountId", account._id),
        )
        .take(REMOVAL_ROW_BATCH_SIZE),
    ),
  async (ctx, account) => {
    await deleteHostedRoutes(ctx, account);
    await removeFromAgentAllowlists(ctx, account);
    return false;
  },
] satisfies RemovalStep[];

async function deleteRows(ctx: MutationCtx, rows: { _id: Id<TableNames> }[]) {
  for (const row of rows) await ctx.db.delete(row._id);
  return rows.length > 0;
}

async function deleteMessages(ctx: MutationCtx, account: Account) {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_account_received", (q) => q.eq("accountId", account._id))
    .take(REMOVAL_MESSAGE_BATCH_SIZE);
  for (const message of messages) await deleteMessage(ctx, message);
  return messages.length > 0;
}

async function deleteMessage(ctx: MutationCtx, message: Doc<"messages">) {
  const messageId = message._id;
  const [
    contents,
    attachments,
    classifications,
    cleanViews,
    embeddingJobs,
    embeddings,
    deliveries,
  ] = await Promise.all([
    ctx.db
      .query("messageContents")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect(),
    ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect(),
    ctx.db
      .query("messageClassifications")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect(),
    ctx.db
      .query("messageCleanViews")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect(),
    ctx.db
      .query("messageEmbeddingJobs")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect(),
    ctx.db
      .query("messageEmbeddings")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect(),
    ctx.db
      .query("notificationDeliveries")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect(),
  ]);
  const tickets = (
    await Promise.all(
      deliveries.map(
        async (delivery) =>
          await ctx.db
            .query("notificationPushTickets")
            .withIndex("by_delivery", (q) => q.eq("deliveryId", delivery._id))
            .collect(),
      ),
    )
  ).flat();
  await deleteStorage(ctx, [
    ...contents.flatMap((content) => [
      content.htmlStorageId,
      content.rawStorageId,
    ]),
    ...attachments.map((attachment) => attachment.storageId),
  ]);
  for (const row of [
    ...tickets,
    ...deliveries,
    ...contents,
    ...attachments,
    ...classifications,
    ...cleanViews,
    ...embeddingJobs,
    ...embeddings,
  ]) {
    await ctx.db.delete(row._id);
  }
  await ctx.db.delete(message._id);
}

async function deleteOutbox(ctx: MutationCtx, account: Account) {
  const outboxes = await ctx.db
    .query("outboxMessages")
    .withIndex("by_account_idempotency", (q) => q.eq("accountId", account._id))
    .take(REMOVAL_OUTBOX_BATCH_SIZE);
  for (const outbox of outboxes) {
    const drafts = await ctx.db
      .query("draftAttachments")
      .withIndex("by_outbox", (q) => q.eq("outboxId", outbox._id))
      .collect();
    await deleteStorage(
      ctx,
      drafts.map((draft) => draft.storageId),
    );
    for (const draft of drafts) await ctx.db.delete(draft._id);
    const sesMessageId = outbox.remoteMessageId?.startsWith("ses:")
      ? outbox.remoteMessageId.slice("ses:".length)
      : undefined;
    if (sesMessageId) {
      const events = await ctx.db
        .query("hostedDeliveryEvents")
        .withIndex("by_ses_message", (q) => q.eq("sesMessageId", sesMessageId))
        .collect();
      for (const event of events) await ctx.db.delete(event._id);
    }
    await ctx.db.delete(outbox._id);
  }
  return outboxes.length > 0;
}

async function deleteStorage(
  ctx: MutationCtx,
  storageIds: (Id<"_storage"> | undefined)[],
) {
  for (const storageId of new Set(storageIds)) {
    if (storageId && (await ctx.db.system.get(storageId))) {
      await ctx.storage.delete(storageId);
    }
  }
}

/** Later mail to a removed hosted address is dropped instead of routed. */
async function deleteHostedRoutes(ctx: MutationCtx, account: Account) {
  const addresses = await ctx.db
    .query("hostedAddresses")
    .withIndex("by_account", (q) => q.eq("accountId", account._id))
    .collect();
  for (const address of addresses) await ctx.db.delete(address._id);
  const domains = await ctx.db
    .query("hostedDomains")
    .withIndex("by_owner", (q) => q.eq("ownerId", account.ownerId))
    .collect();
  for (const domain of domains) {
    if (domain.catchAllAccountId === account._id) {
      await ctx.db.patch(domain._id, {
        catchAllAccountId: undefined,
        updatedAt: Date.now(),
      });
    }
  }
}

async function removeFromAgentAllowlists(ctx: MutationCtx, account: Account) {
  const credentials = await ctx.db
    .query("agentCredentials")
    .withIndex("by_owner", (q) => q.eq("ownerId", account.ownerId))
    .collect();
  for (const credential of credentials) {
    const access = credential.accountAccess;
    if (access.mode !== "allowlist" || !access.accountIds.includes(account._id))
      continue;
    await ctx.db.patch(credential._id, {
      accountAccess: {
        mode: "allowlist",
        accountIds: access.accountIds.filter((id) => id !== account._id),
      },
      updatedAt: Date.now(),
    });
  }
}
