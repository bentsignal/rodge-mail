/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { api } from "../_generated/api";
import schema from "../schema";

vi.mock("../convex.env", () => ({
  env: { AUTH_ALLOWED_USER_ID: "owner" },
}));

const modules = import.meta.glob("/src/**/*.ts");
const OWNER = "owner";
const page = { cursor: null, numItems: 20 };

function setup() {
  const t = convexTest(schema, modules);
  return { t, owner: t.withIdentity({ subject: OWNER }) };
}

async function insertAccount(
  ctx: MutationCtx,
  provider: "gmail" | "hosted",
  address: string,
) {
  return await ctx.db.insert("mailAccounts", {
    ownerId: OWNER,
    provider,
    remoteAccountId: address,
    address,
    status: "connected",
    createdAt: 1,
    updatedAt: 1,
  });
}

async function insertThread(
  ctx: MutationCtx,
  accountId: Id<"mailAccounts">,
  message: {
    direction?: "incoming" | "outgoing";
    inInbox: boolean;
    labels: string[];
    receivedAt: number;
    subject: string;
  },
) {
  const threadId = await ctx.db.insert("threads", {
    ownerId: OWNER,
    accountId,
    remoteThreadId: message.subject,
    subject: message.subject,
    snippet: message.subject,
    participants: [],
    latestMessageAt: message.receivedAt,
    latestInboxMessageAt: message.inInbox ? message.receivedAt : undefined,
    messageCount: 1,
    unreadCount: 0,
    inInbox: message.inInbox,
    isPinned: false,
    hasAttachments: false,
    createdAt: 1,
    updatedAt: 1,
  });
  const messageId = await ctx.db.insert("messages", {
    ownerId: OWNER,
    accountId,
    threadId,
    remoteMessageId: message.subject,
    direction: message.direction ?? "incoming",
    from: { address: "friend@example.com" },
    to: [],
    cc: [],
    bcc: [],
    subject: message.subject,
    snippet: message.subject,
    searchText: message.subject.toLowerCase(),
    remoteLabelIds: message.labels,
    bodyState: "available",
    receivedAt: message.receivedAt,
    hasAttachments: false,
    inInbox: message.inInbox,
    isRead: true,
    isPinned: false,
    createdAt: 1,
    updatedAt: 1,
  });
  if (message.inInbox) {
    await ctx.db.patch(threadId, { latestInboxMessageId: messageId });
  }
  return threadId;
}

async function seedMailbox(t: ReturnType<typeof setup>["t"]) {
  return await t.run(async (ctx) => {
    const hosted = await insertAccount(ctx, "hosted", "me@example.com");
    const gmail = await insertAccount(ctx, "gmail", "me@example.org");
    const trip = await insertThread(ctx, hosted, {
      inInbox: false,
      labels: ["folder:Projects/Trips"],
      receivedAt: 500,
      subject: "Lisbon itinerary",
    });
    await insertThread(ctx, hosted, {
      inInbox: true,
      labels: ["inbox"],
      receivedAt: 400,
      subject: "Lisbon dinner",
    });
    await insertThread(ctx, hosted, {
      inInbox: false,
      labels: ["junk"],
      receivedAt: 300,
      subject: "Lisbon cruise prize",
    });
    await insertThread(ctx, hosted, {
      direction: "outgoing",
      inInbox: false,
      labels: ["sent"],
      receivedAt: 200,
      subject: "Lisbon flights booked",
    });
    const gmailArchive = await insertThread(ctx, gmail, {
      inInbox: false,
      labels: ["UNREAD"],
      receivedAt: 100,
      subject: "Lisbon photos",
    });
    return { gmail, gmailArchive, hosted, trip };
  });
}

it("lists every non-junk thread newest first with its location", async () => {
  const { t, owner } = setup();
  const { hosted } = await seedMailbox(t);

  const all = await owner.query(api.mail.queries.listAllMail, {
    paginationOpts: page,
  });
  expect(
    all.page.map((row) => [row.subject, row.location.kind, row.location.name]),
  ).toEqual([
    ["Lisbon itinerary", "custom", "Projects/Trips"],
    ["Lisbon dinner", "inbox", undefined],
    ["Lisbon flights booked", "sent", undefined],
    ["Lisbon photos", "archive", undefined],
  ]);

  const one = await owner.query(api.mail.queries.listAllMail, {
    accountId: hosted,
    paginationOpts: page,
  });
  expect(one.page).toHaveLength(3);
});

it("searches all stored mail only when asked to", async () => {
  const { t, owner } = setup();
  await seedMailbox(t);

  const inbox = await owner.query(api.mail.queries.searchHeaders, {
    searchTerm: "lisbon",
    paginationOpts: page,
  });
  expect(inbox.page.map((row) => row.subject)).toEqual(["Lisbon dinner"]);

  const all = await owner.query(api.mail.queries.searchHeaders, {
    searchTerm: "lisbon",
    paginationOpts: page,
    scope: "all",
  });
  expect(all.page.map((row) => row.subject).sort()).toEqual([
    "Lisbon dinner",
    "Lisbon flights booked",
    "Lisbon itinerary",
    "Lisbon photos",
  ]);
});

it("moves hosted folder mail into the inbox but leaves Gmail's alone", async () => {
  const { t, owner } = setup();
  const { gmailArchive, trip } = await seedMailbox(t);

  await owner.mutation(api.mail.archiveMutations.moveThreadToInbox, {
    threadId: trip,
  });
  const thread = await owner.query(api.mail.queries.getThread, {
    threadId: trip,
  });
  expect(thread?.inInbox).toBe(true);
  expect(thread?.messages[0]?.location).toEqual({ kind: "inbox" });

  const inbox = await owner.query(api.mail.queries.listInbox, {
    paginationOpts: page,
  });
  expect(inbox.page.map((row) => row.subject)).toContain("Lisbon itinerary");

  await expect(
    owner.mutation(api.mail.archiveMutations.moveThreadToInbox, {
      threadId: gmailArchive,
    }),
  ).rejects.toThrow("Move this conversation in your mail provider");
});
