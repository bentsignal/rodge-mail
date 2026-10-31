import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { ISOLATED_ACCOUNTS } from "./devSeedMailbox";
import { ISOLATED_OWNER_NAME } from "./devSeedMailbox";

type AccountKey = (typeof ISOLATED_ACCOUNTS)[number]["key"];

interface SentSeed {
  account: AccountKey;
  to: [name: string, address: string][];
  cc?: [name: string, address: string][];
  subject: string;
  body: string;
  hoursAgo: number;
  status: "failed" | "pending" | "sending" | "sent";
  /** Whether the provider's copy has synced into the mailbox. */
  stored?: boolean;
  /** Reply in the seeded inbox thread with this remote id. */
  thread?: string;
  attachment?: { fileName: string; contentType: string; size: number };
  error?: string;
}

const SENT_SEEDS = [
  {
    account: "gmail",
    to: [["Maya Chen", "maya@northwind.example"]],
    cc: [["Priya Patel", "priya@northwind.example"]],
    subject: "Notes from today's call",
    body: "Hi Maya,\n\nHere are the notes from today's call. The short version: we ship the beta on the 14th and keep the old importer for another month.\n\nAlex",
    hoursAgo: 0.02,
    status: "pending",
  },
  {
    account: "microsoft",
    to: [["Finance Team", "finance@northwind.example"]],
    subject: "Quarterly numbers",
    body: "Attached are the quarterly numbers we discussed. Let me know if anything looks off.\n\nAlex",
    hoursAgo: 1.2,
    status: "failed",
    error: "Microsoft 365 rejected the message: the connection needs to be renewed.",
    attachment: {
      fileName: "q3-numbers.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 48_213,
    },
  },
  {
    account: "microsoft",
    to: [["Maya Chen", "maya@northwind.example"]],
    subject: "Re: Can we move tomorrow's review?",
    body: "11 works for me. I'll move the invite and let the team know.\n\nAlex",
    hoursAgo: 0.1,
    status: "sent",
    stored: true,
    thread: "isolated-thread-0",
  },
  {
    account: "gmail",
    to: [
      ["Jordan Blake", "jordan@example.org"],
      ["Sam Ortiz", "sam@example.org"],
    ],
    cc: [["Riley Park", "riley@example.org"]],
    subject: "Weekend hike?",
    body: "Anyone up for the ridge trail on Saturday? I attached the map. We'd leave at 8 and be back by 2.\n\nAlex",
    hoursAgo: 3,
    status: "sent",
    stored: true,
    attachment: {
      fileName: "ridge-trail-map.pdf",
      contentType: "application/pdf",
      size: 812_455,
    },
  },
  {
    account: "hosted",
    to: [["Accounts Payable", "billing@client.example"]],
    subject: "Invoice #204",
    body: "Hello,\n\nPlease find invoice #204 for October attached. Payment is due within 30 days.\n\nThank you,\nAlex Rivera",
    hoursAgo: 26,
    status: "sent",
    attachment: {
      fileName: "invoice-204.pdf",
      contentType: "application/pdf",
      size: 96_520,
    },
  },
  {
    account: "icloud",
    to: [
      ["Casey Rivera", "casey@example.net"],
      ["Morgan Lee", "morgan@studio.example"],
    ],
    subject: "Dinner on Friday",
    body: "Booked a table for four at 7:30 on Friday. See you there!\n\nAlex",
    hoursAgo: 50,
    status: "sent",
    stored: true,
  },
] satisfies SentSeed[];

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
    const at = Math.round(now - seed.hoursAgo * 60 * 60 * 1000);
    const remoteMessageId = `isolated-sent-${index}`;
    const to = toAddresses(seed.to);
    const cc = toAddresses(seed.cc ?? []);
    const attachment: SentSeed["attachment"] = seed.attachment;
    if (seed.status === "sent" && seed.stored) {
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
      idempotencyKey: `isolated-sent-${index}`,
      to,
      cc,
      bcc: [],
      subject: seed.subject,
      plainText: seed.body,
      status: seed.status,
      attempt: seed.status === "pending" ? 0 : 1,
      ...(seed.status === "sent"
        ? {
            remoteMessageId,
            sentAt: at,
            ...(attachment ? { sentAttachments: [attachment] } : {}),
          }
        : {}),
      ...(seed.status === "failed" ? { error: seed.error } : {}),
      createdAt: at,
      updatedAt: at,
    });
    if (attachment && seed.status !== "sent") {
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
    searchText: [account.address, ...args.to.map((r) => r.address), args.subject]
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
