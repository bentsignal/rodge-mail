import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { SentSeed } from "./devSeedSentFixtures";
import { ISOLATED_OWNER_NAME } from "./devSeedMailbox";
import { SENT_SEEDS } from "./devSeedSentFixtures";

/** Sent mail and outbox rows for the isolated backend's seeded mailbox. */
export async function seedSentMail(
  ctx: MutationCtx,
  ownerId: string,
  accountIds: Map<string, Id<"mailAccounts">>,
  now: number,
) {
  for (const [index, seed] of SENT_SEEDS.entries()) {
    const accountId = accountIds.get(seed.account);
    const account = accountId ? await ctx.db.get(accountId) : null;
    if (!account) continue;
    await seedSentMessage(ctx, { account, index, now, ownerId, seed });
  }
}

async function seedSentMessage(
  ctx: MutationCtx,
  {
    account,
    index,
    now,
    ownerId,
    seed,
  }: {
    account: { _id: Id<"mailAccounts">; address: string; ownerId: string };
    index: number;
    now: number;
    ownerId: string;
    seed: SentSeed;
  },
) {
  const at = Math.round(now - seed.hoursAgo * 60 * 60 * 1000);
  const remoteMessageId = `isolated-sent-${index}`;
  const to = toAddresses(seed.to);
  const cc = toAddresses(seed.cc ?? []);
  const { attachment, status } = seed;
  if (status === "sent" && seed.stored) {
    await insertStoredSentMessage(ctx, {
      account,
      at,
      attachment,
      body: seed.body,
      cc,
      now,
      remoteMessageId,
      subject: seed.subject,
      thread: seed.thread,
      to,
    });
  }
  const outboxId = await ctx.db.insert("outboxMessages", {
    ownerId,
    accountId: account._id,
    idempotencyKey: remoteMessageId,
    to,
    cc,
    bcc: [],
    subject: seed.subject,
    plainText: seed.body,
    status,
    attempt: status === "pending" ? 0 : 1,
    ...getSeedDelivery({
      at,
      attachment,
      error: seed.error,
      remoteMessageId,
      status,
    }),
    createdAt: at,
    updatedAt: at,
  });
  if (attachment && status !== "sent") {
    const draftId = await ctx.db.insert("draftAttachments", {
      ownerId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      declaredSize: attachment.size,
      size: attachment.size,
      status: "claimed",
      outboxId,
      createdAt: at,
      updatedAt: at,
    });
    await ctx.db.patch(outboxId, { attachmentIds: [draftId] });
  }
}

function getSeedDelivery({
  at,
  attachment,
  error,
  remoteMessageId,
  status,
}: {
  at: number;
  attachment: SentSeed["attachment"];
  error: string | undefined;
  remoteMessageId: string;
  status: SentSeed["status"];
}) {
  if (status === "failed") return { error };
  if (status !== "sent") return {};
  return {
    remoteMessageId,
    sentAt: at,
    ...(attachment ? { sentAttachments: [attachment] } : {}),
  };
}

export async function deleteAccountOutbox(
  ctx: MutationCtx,
  accountId: Id<"mailAccounts">,
) {
  const outboxes = await ctx.db
    .query("outboxMessages")
    .withIndex("by_account_idempotency", (q) => q.eq("accountId", accountId))
    .collect();
  for (const outbox of outboxes) {
    const drafts = await ctx.db
      .query("draftAttachments")
      .withIndex("by_outbox", (q) => q.eq("outboxId", outbox._id))
      .collect();
    for (const draft of drafts) await ctx.db.delete(draft._id);
    await ctx.db.delete(outbox._id);
  }
}

async function insertStoredSentMessage(
  ctx: MutationCtx,
  args: {
    account: { _id: Id<"mailAccounts">; address: string; ownerId: string };
    at: number;
    attachment: SentSeed["attachment"];
    body: string;
    cc: { address: string; name: string }[];
    now: number;
    remoteMessageId: string;
    subject: string;
    thread: string | undefined;
    to: { address: string; name: string }[];
  },
) {
  const { account, at, now } = args;
  const from = { address: account.address, name: ISOLATED_OWNER_NAME };
  const snippet = args.body.replace(/\s+/gu, " ").slice(0, 140);
  const threadId = await ensureSentThread(ctx, { ...args, from, snippet });
  const messageId = await ctx.db.insert("messages", {
    ownerId: account.ownerId,
    accountId: account._id,
    threadId,
    remoteMessageId: args.remoteMessageId,
    internetMessageId: `<${args.remoteMessageId}@seed.example>`,
    direction: "outgoing",
    from,
    to: args.to,
    cc: args.cc,
    bcc: [],
    subject: args.subject,
    snippet,
    searchText: [
      account.address,
      ...args.to.map((r) => r.address),
      args.subject,
    ]
      .join(" ")
      .toLowerCase(),
    remoteLabelIds: ["SENT"],
    bodyState: "available",
    sentAt: at,
    receivedAt: at,
    hasAttachments: args.attachment !== undefined,
    inInbox: false,
    isRead: true,
    isPinned: false,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("messageContents", {
    ownerId: account.ownerId,
    messageId,
    plainText: args.body,
    truncated: false,
    createdAt: now,
    updatedAt: now,
  });
  if (args.attachment) {
    await ctx.db.insert("attachments", {
      ownerId: account.ownerId,
      messageId,
      remoteAttachmentId: `${args.remoteMessageId}-attachment`,
      fileName: args.attachment.fileName,
      contentType: args.attachment.contentType,
      size: args.attachment.size,
      isInline: false,
      status: "remote",
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function ensureSentThread(
  ctx: MutationCtx,
  args: {
    account: { _id: Id<"mailAccounts">; ownerId: string };
    at: number;
    attachment: SentSeed["attachment"];
    from: { address: string; name: string };
    now: number;
    remoteMessageId: string;
    snippet: string;
    subject: string;
    thread: string | undefined;
  },
) {
  const remoteThreadId = args.thread ?? `${args.remoteMessageId}-thread`;
  const existing = await ctx.db
    .query("threads")
    .withIndex("by_account_remote", (q) =>
      q.eq("accountId", args.account._id).eq("remoteThreadId", remoteThreadId),
    )
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      messageCount: existing.messageCount + 1,
      latestMessageAt: Math.max(existing.latestMessageAt, args.at),
      updatedAt: args.now,
    });
    return existing._id;
  }
  return await ctx.db.insert("threads", {
    ownerId: args.account.ownerId,
    accountId: args.account._id,
    remoteThreadId,
    subject: args.subject,
    snippet: args.snippet,
    participants: [args.from],
    latestMessageAt: args.at,
    messageCount: 1,
    unreadCount: 0,
    inInbox: false,
    isPinned: false,
    hasAttachments: args.attachment !== undefined,
    createdAt: args.now,
    updatedAt: args.now,
  });
}

function toAddresses(list: [name: string, address: string][]) {
  return list.map(([name, address]) => ({ address, name }));
}
