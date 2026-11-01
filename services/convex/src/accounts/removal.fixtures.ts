/* eslint-disable max-lines -- One fixture row for every table an account owns. */
import type { StorageActionWriter } from "convex/server";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const OWNER = "owner";

type SeedCtx = MutationCtx & { storage: StorageActionWriter };

interface SeedBase {
  ownerId: string;
  accountId: Id<"mailAccounts">;
  address: string;
  now: number;
}

function stampOf(base: SeedBase) {
  return { ownerId: base.ownerId, createdAt: base.now, updatedAt: base.now };
}

export type Seeded = Awaited<ReturnType<typeof seedAccount>>;

export async function seedAccount(
  ctx: SeedCtx,
  options: {
    address: string;
    provider: "gmail" | "hosted";
    messageCount: number;
  },
) {
  const now = Date.now();
  const stamp = { ownerId: OWNER, createdAt: now, updatedAt: now };
  const accountId = await ctx.db.insert("mailAccounts", {
    ...stamp,
    provider: options.provider,
    remoteAccountId: options.address,
    address: options.address,
    status: "connected",
  });
  const base = { ownerId: OWNER, accountId, address: options.address, now };
  await ctx.db.insert("mailFolders", {
    ...stamp,
    accountId,
    remoteFolderId: "INBOX",
    name: "Inbox",
    kind: "inbox",
  });
  const threadId = await ctx.db.insert("threads", {
    ...stamp,
    accountId,
    remoteThreadId: `${options.address}:thread`,
    subject: "Hello",
    snippet: "Hello",
    participants: [{ address: "friend@example.com" }],
    latestMessageAt: now,
    latestInboxMessageAt: now,
    messageCount: options.messageCount,
    unreadCount: options.messageCount,
    inInbox: true,
    isPinned: false,
    hasAttachments: true,
  });
  const pushTokenId = await ctx.db.insert("mobilePushTokens", {
    ...stamp,
    token: `token:${options.address}`,
    deviceId: `device:${options.address}`,
    platform: "ios",
    enabled: true,
  });
  const storageIds = [];
  const messageIds = [];
  for (let index = 0; index < options.messageCount; index += 1) {
    const seeded = await seedMessage(ctx, {
      base,
      threadId,
      pushTokenId,
      index,
    });
    messageIds.push(seeded.messageId);
    storageIds.push(...seeded.storageIds);
  }
  await seedAccountRows(ctx, base, messageIds[0]);
  storageIds.push(await seedOutbox(ctx, base));
  if (options.provider === "hosted") await seedHostedRoutes(ctx, base);
  await ctx.db.insert("mailImports", {
    ownerId: OWNER,
    updatedAt: now,
    sourceAccountId: accountId,
    targetAccountId: accountId,
    status: "completed",
    runId: "1",
    imported: 0,
    skipped: 0,
    failed: 0,
    recentFailures: [],
    consecutiveErrors: 0,
    startedAt: now,
  });
  return { accountId, threadId, messageIds, storageIds };
}

async function seedMessage(
  ctx: SeedCtx,
  {
    base,
    threadId,
    pushTokenId,
    index,
  }: {
    base: SeedBase;
    threadId: Id<"threads">;
    pushTokenId: Id<"mobilePushTokens">;
    index: number;
  },
) {
  const stamp = stampOf(base);
  const messageId = await ctx.db.insert("messages", {
    ...stamp,
    accountId: base.accountId,
    threadId,
    remoteMessageId: `${base.address}:${index}`,
    direction: "incoming",
    from: { address: "friend@example.com" },
    to: [{ address: base.address }],
    cc: [],
    bcc: [],
    subject: "Hello",
    snippet: "Hello",
    searchText: "hello",
    bodyState: "available",
    receivedAt: base.now - index,
    hasAttachments: true,
    inInbox: true,
    isRead: false,
    isPinned: false,
  });
  const htmlStorageId = await ctx.storage.store(new Blob(["<p>hi</p>"]));
  const attachmentStorageId = await ctx.storage.store(new Blob(["file"]));
  await ctx.db.insert("messageContents", {
    ...stamp,
    messageId,
    plainText: "hi",
    htmlStorageId,
    truncated: false,
  });
  await ctx.db.insert("attachments", {
    ...stamp,
    messageId,
    remoteAttachmentId: "a1",
    fileName: "a.txt",
    contentType: "text/plain",
    size: 4,
    isInline: false,
    status: "available",
    storageId: attachmentStorageId,
  });
  await seedMessageAnalysis(ctx, base, messageId);
  const deliveryId = await ctx.db.insert("notificationDeliveries", {
    ...stamp,
    messageId,
    status: "sent",
    tokenCount: 1,
  });
  await ctx.db.insert("notificationPushTickets", {
    ...stamp,
    deliveryId,
    tokenId: pushTokenId,
    status: "delivered",
    receiptAttempts: 1,
  });
  return { messageId, storageIds: [htmlStorageId, attachmentStorageId] };
}

async function seedMessageAnalysis(
  ctx: SeedCtx,
  base: SeedBase,
  messageId: Id<"messages">,
) {
  const stamp = stampOf(base);
  const embedding = {
    accountId: base.accountId,
    messageId,
    reason: "inbox" as const,
    contentHash: "hash",
    model: "test",
    dimensions: 512,
  };
  await ctx.db.insert("messageClassifications", {
    ...stamp,
    messageId,
    status: "classified",
    category: "personal",
    importance: 0.5,
    confidence: 1,
    reason: "test",
    summary: "test",
    shouldEmbed: true,
    source: "rules",
    promptVersion: "test",
  });
  await ctx.db.insert("messageCleanViews", {
    ...stamp,
    messageId,
    status: "ready",
    promptVersion: "test",
    outputSchemaVersion: "test",
    jobKey: `clean:${messageId}`,
    inputHash: "hash",
  });
  await ctx.db.insert("messageEmbeddingJobs", {
    ...stamp,
    ...embedding,
    status: "embedded",
    jobKey: `embed:${messageId}`,
    attempt: 1,
  });
  await ctx.db.insert("messageEmbeddings", {
    ...stamp,
    ...embedding,
    vector: Array.from({ length: 512 }, () => 0.01),
  });
}

async function seedAccountRows(
  ctx: SeedCtx,
  base: SeedBase,
  sourceMessageId: Id<"messages"> | undefined,
) {
  const stamp = stampOf(base);
  const { accountId } = base;
  await ctx.db.insert("archivedMessageTombstones", {
    ownerId: base.ownerId,
    accountId,
    remoteMessageId: `${base.address}:archived`,
    archivedAt: base.now,
    createdAt: base.now,
  });
  if (sourceMessageId) {
    await ctx.db.insert("mailingListSuppressions", {
      ...stamp,
      accountId,
      sourceMessageId,
      senderAddress: "news@example.com",
      displayName: "News",
      remoteMethod: "none",
      remoteStatus: "unavailable",
    });
  }
  await ctx.db.insert("syncRuns", {
    ...stamp,
    accountId,
    reason: "incremental",
    status: "succeeded",
    attempt: 1,
  });
  await ctx.db.insert("providerCredentials", {
    ...stamp,
    accountId,
    provider: "gmail",
    encryptedTokens: {
      formatVersion: 1,
      keyVersion: "v1",
      iv: "iv",
      ciphertext: "secret",
    },
  });
  await ctx.db.insert("accountNotificationPreferences", {
    ...stamp,
    accountId,
    newMailEnabled: false,
  });
}

export function sesIdFor(address: string) {
  return address.replace(/\W/gu, "");
}

async function seedOutbox(ctx: SeedCtx, base: SeedBase) {
  const stamp = stampOf(base);
  const outboxId = await ctx.db.insert("outboxMessages", {
    ...stamp,
    accountId: base.accountId,
    idempotencyKey: `send:${base.address}`,
    to: [{ address: "friend@example.com" }],
    cc: [],
    bcc: [],
    subject: "Hi",
    plainText: "Hi",
    status: "sent",
    attempt: 1,
    remoteMessageId: `ses:${sesIdFor(base.address)}`,
  });
  const storageId = await ctx.storage.store(new Blob(["draft"]));
  await ctx.db.insert("draftAttachments", {
    ...stamp,
    fileName: "draft.txt",
    contentType: "text/plain",
    declaredSize: 5,
    storageId,
    status: "claimed",
    outboxId,
  });
  await ctx.db.insert("hostedDeliveryEvents", {
    ownerId: base.ownerId,
    sesMessageId: sesIdFor(base.address),
    type: "delivery",
    recipients: [{ address: "friend@example.com" }],
    occurredAt: base.now,
    createdAt: base.now,
  });
  return storageId;
}

async function seedHostedRoutes(ctx: SeedCtx, base: SeedBase) {
  const domain = base.address.split("@")[1] ?? "";
  await ctx.db.insert("hostedDomains", {
    ...stampOf(base),
    domain,
    catchAllAccountId: base.accountId,
  });
  for (const address of [base.address, `alias@${domain}`]) {
    await ctx.db.insert("hostedAddresses", {
      ownerId: base.ownerId,
      accountId: base.accountId,
      address,
      domain,
      createdAt: base.now,
    });
  }
}
