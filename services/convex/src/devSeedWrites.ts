import { ConvexError } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { DemoAccount, DemoMessage } from "./devSeedFixtures";

const SEED_PROMPT_VERSION = "demo-v1";

export async function ensureDemoAccount(
  ctx: MutationCtx,
  ownerId: string,
  fixture: DemoAccount,
) {
  const existing = await ctx.db
    .query("mailAccounts")
    .withIndex("by_owner_provider_remote", (q) =>
      q
        .eq("ownerId", ownerId)
        .eq("provider", fixture.provider)
        .eq("remoteAccountId", fixture.remoteAccountId),
    )
    .first();
  const now = Date.now();
  const accountId = existing
    ? existing._id
    : await ctx.db.insert("mailAccounts", {
        ownerId,
        provider: fixture.provider,
        remoteAccountId: fixture.remoteAccountId,
        address: fixture.address,
        displayName: fixture.displayName,
        status: "connected",
        isDemo: true,
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now,
      });

  const folder = await ctx.db
    .query("mailFolders")
    .withIndex("by_account_remote", (q) =>
      q.eq("accountId", accountId).eq("remoteFolderId", "inbox"),
    )
    .first();
  if (!folder) {
    await ctx.db.insert("mailFolders", {
      ownerId,
      accountId,
      remoteFolderId: "inbox",
      name: "Inbox",
      kind: "inbox",
      createdAt: now,
      updatedAt: now,
    });
  }
  return accountId;
}

export async function ensureDemoMessage(
  ctx: MutationCtx,
  ownerId: string,
  accountId: Id<"mailAccounts">,
  fixture: DemoMessage,
) {
  const existing = await ctx.db
    .query("messages")
    .withIndex("by_account_remote", (q) =>
      q
        .eq("accountId", accountId)
        .eq("remoteMessageId", fixture.remoteMessageId),
    )
    .first();
  if (existing) return 0;

  const account = await ctx.db.get(accountId);
  if (!account) throw new ConvexError("Demo account not found");
  const now = Date.now();
  const threadId = await ensureDemoThread({
    ctx,
    ownerId,
    accountId,
    fixture,
    now,
  });
  const recipient = { address: account.address, name: "Shawn" };
  const messageId = await ctx.db.insert("messages", {
    ownerId,
    accountId,
    threadId,
    remoteMessageId: fixture.remoteMessageId,
    internetMessageId: fixture.internetMessageId,
    direction: "incoming",
    from: fixture.from,
    to: [recipient],
    cc: [],
    bcc: [],
    subject: fixture.subject,
    snippet: fixture.snippet,
    searchText: createSearchText(fixture, recipient.address),
    headers: [
      { name: "From", value: formatAddress(fixture.from) },
      { name: "To", value: recipient.address },
      { name: "Subject", value: fixture.subject },
      { name: "Message-ID", value: fixture.internetMessageId },
    ],
    remoteLabelIds: ["INBOX"],
    bodyState: "available",
    receivedAt: fixture.receivedAt,
    hasAttachments: fixture.attachment !== undefined,
    inInbox: true,
    isRead: fixture.isRead,
    isPinned: fixture.isPinned,
    focusBucket: fixture.bucket,
    createdAt: now,
    updatedAt: now,
  });

  await Promise.all([
    ctx.db.insert("messageContents", {
      ownerId,
      messageId,
      plainText: fixture.body,
      truncated: false,
      createdAt: now,
      updatedAt: now,
    }),
    ctx.db.insert("messageClassifications", {
      ownerId,
      messageId,
      status: "classified",
      bucket: fixture.bucket,
      category: fixture.category,
      importance: fixture.importance,
      confidence: fixture.confidence,
      reason: fixture.reason,
      summary: fixture.summary,
      shouldEmbed: fixture.shouldEmbed,
      source: "seed",
      promptVersion: SEED_PROMPT_VERSION,
      classifiedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  if (fixture.attachment) {
    await ctx.db.insert("attachments", {
      ownerId,
      messageId,
      remoteAttachmentId: fixture.attachment.remoteAttachmentId,
      fileName: fixture.attachment.fileName,
      contentType: fixture.attachment.contentType,
      size: fixture.attachment.size,
      isInline: false,
      status: "remote",
      createdAt: now,
      updatedAt: now,
    });
  }
  return 1;
}

export async function deleteDemoAccountRecords(
  ctx: MutationCtx,
  accountId: Id<"mailAccounts">,
) {
  const threads = await ctx.db
    .query("threads")
    .withIndex("by_account_latest", (q) => q.eq("accountId", accountId))
    .collect();
  for (const thread of threads) {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
      .collect();
    for (const message of messages)
      await deleteMessageRecords(ctx, message._id);
    await ctx.db.delete(thread._id);
  }

  const folders = await ctx.db
    .query("mailFolders")
    .withIndex("by_account_kind", (q) => q.eq("accountId", accountId))
    .collect();
  for (const folder of folders) await ctx.db.delete(folder._id);

  const syncRuns = await ctx.db
    .query("syncRuns")
    .withIndex("by_account_created", (q) => q.eq("accountId", accountId))
    .collect();
  for (const run of syncRuns) await ctx.db.delete(run._id);
  await ctx.db.delete(accountId);
}

async function ensureDemoThread({
  ctx,
  ownerId,
  accountId,
  fixture,
  now,
}: {
  ctx: MutationCtx;
  ownerId: string;
  accountId: Id<"mailAccounts">;
  fixture: DemoMessage;
  now: number;
}) {
  const existing = await ctx.db
    .query("threads")
    .withIndex("by_account_remote", (q) =>
      q.eq("accountId", accountId).eq("remoteThreadId", fixture.remoteThreadId),
    )
    .first();
  if (existing) return existing._id;

  return await ctx.db.insert("threads", {
    ownerId,
    accountId,
    remoteThreadId: fixture.remoteThreadId,
    subject: fixture.subject,
    snippet: fixture.snippet,
    participants: [fixture.from],
    latestMessageAt: fixture.receivedAt,
    messageCount: 1,
    unreadCount: fixture.isRead ? 0 : 1,
    hasAttachments: fixture.attachment !== undefined,
    createdAt: now,
    updatedAt: now,
  });
}

async function deleteMessageRecords(
  ctx: MutationCtx,
  messageId: Id<"messages">,
) {
  const [contents, attachments, classifications, embeddingJobs, embeddings] =
    await Promise.all([
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
        .query("messageEmbeddingJobs")
        .withIndex("by_message", (q) => q.eq("messageId", messageId))
        .collect(),
      ctx.db
        .query("messageEmbeddings")
        .withIndex("by_message", (q) => q.eq("messageId", messageId))
        .collect(),
    ]);
  for (const row of [
    ...contents,
    ...attachments,
    ...classifications,
    ...embeddingJobs,
    ...embeddings,
  ]) {
    await ctx.db.delete(row._id);
  }
  await ctx.db.delete(messageId);
}

function createSearchText(fixture: DemoMessage, recipient: string) {
  return [fixture.from.name, fixture.from.address, recipient, fixture.subject]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatAddress(address: DemoMessage["from"]) {
  return address.name
    ? `${address.name} <${address.address}>`
    : address.address;
}
