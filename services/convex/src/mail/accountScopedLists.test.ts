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
  address: string,
  ownerId = OWNER,
) {
  return await ctx.db.insert("mailAccounts", {
    ownerId,
    provider: "gmail",
    remoteAccountId: address,
    address,
    status: "connected",
    createdAt: 1,
    updatedAt: 1,
  });
}

async function insertSent(
  ctx: MutationCtx,
  accountId: Id<"mailAccounts">,
  {
    createdAt,
    status = "sent",
    subject,
  }: { createdAt: number; status?: "failed" | "sent"; subject: string },
) {
  await ctx.db.insert("outboxMessages", {
    ownerId: OWNER,
    accountId,
    idempotencyKey: subject,
    to: [{ address: "to@example.com" }],
    cc: [],
    bcc: [],
    subject,
    plainText: subject,
    status,
    attempt: 1,
    createdAt,
    updatedAt: createdAt,
  });
}

async function insertSpam(
  ctx: MutationCtx,
  accountId: Id<"mailAccounts">,
  subject: string,
  at: number,
) {
  const threadId = await ctx.db.insert("threads", {
    ownerId: OWNER,
    accountId,
    remoteThreadId: subject,
    subject,
    snippet: subject,
    participants: [],
    latestMessageAt: at,
    latestInboxMessageAt: at,
    messageCount: 1,
    unreadCount: 0,
    inInbox: true,
    isPinned: false,
    hasAttachments: false,
    createdAt: at,
    updatedAt: at,
  });
  const messageId = await ctx.db.insert("messages", {
    ownerId: OWNER,
    accountId,
    threadId,
    remoteMessageId: subject,
    internetMessageId: `<${subject}@example.com>`,
    direction: "incoming",
    from: { address: "spam@example.com" },
    to: [],
    cc: [],
    bcc: [],
    subject,
    snippet: subject,
    searchText: subject,
    remoteLabelIds: [],
    bodyState: "available",
    sentAt: at,
    receivedAt: at,
    hasAttachments: false,
    inInbox: true,
    isRead: false,
    isPinned: false,
    createdAt: at,
    updatedAt: at,
  });
  await ctx.db.insert("messageClassifications", {
    ownerId: OWNER,
    messageId,
    status: "classified",
    category: "noise",
    importance: 0,
    confidence: 1,
    reason: "seed",
    summary: subject,
    shouldEmbed: false,
    isSpam: true,
    source: "seed",
    promptVersion: "test",
    createdAt: at,
    updatedAt: at,
  });
}

it("lists sent mail for every account or for one", async () => {
  const { t, owner } = setup();
  const { first, second } = await t.run(async (ctx) => {
    const first = await insertAccount(ctx, "first@example.com");
    const second = await insertAccount(ctx, "second@example.com");
    await insertSent(ctx, first, { createdAt: 30, subject: "first newer" });
    await insertSent(ctx, second, { createdAt: 20, subject: "second" });
    await insertSent(ctx, first, { createdAt: 10, subject: "first older" });
    await insertSent(ctx, first, {
      createdAt: 40,
      status: "failed",
      subject: "first failed",
    });
    return { first, second };
  });

  async function subjects(accountId?: Id<"mailAccounts">) {
    const result = await owner.query(api.outbox.queries.listSent, {
      accountId,
      paginationOpts: page,
    });
    return result.page.map((row) => row.subject);
  }

  expect(await subjects()).toEqual(["first newer", "second", "first older"]);
  expect(await subjects(first)).toEqual(["first newer", "first older"]);
  expect(await subjects(second)).toEqual(["second"]);
});

it("lists spam for every account or for one", async () => {
  const { t, owner } = setup();
  const { first, second } = await t.run(async (ctx) => {
    const first = await insertAccount(ctx, "first@example.com");
    const second = await insertAccount(ctx, "second@example.com");
    await insertSpam(ctx, first, "first spam", 30);
    await insertSpam(ctx, second, "second spam", 20);
    return { first, second };
  });

  async function subjects(accountId?: Id<"mailAccounts">) {
    const result = await owner.query(api.mail.queries.listSpam, {
      accountId,
      paginationOpts: page,
    });
    return result.page.map((row) => row.subject);
  }

  expect(await subjects()).toEqual(["first spam", "second spam"]);
  expect(await subjects(first)).toEqual(["first spam"]);
  expect(await subjects(second)).toEqual(["second spam"]);
});

it("keeps paging through spam from other accounts", async () => {
  const { t, owner } = setup();
  const first = await t.run(async (ctx) => {
    const first = await insertAccount(ctx, "first@example.com");
    const second = await insertAccount(ctx, "second@example.com");
    for (let index = 0; index < 6; index += 1) {
      await insertSpam(ctx, second, `second ${index}`, 100 - index);
    }
    await insertSpam(ctx, first, "first spam", 1);
    return first;
  });

  const paginationOpts = { cursor: null, numItems: 1 };
  const short = await owner.query(api.mail.queries.listSpam, {
    accountId: first,
    paginationOpts,
  });
  expect(short.page).toEqual([]);
  expect(short.isDone).toBe(false);

  const rest = await owner.query(api.mail.queries.listSpam, {
    accountId: first,
    paginationOpts: { cursor: short.continueCursor, numItems: 1 },
  });
  expect(rest.page.map((row) => row.subject)).toEqual(["first spam"]);
});

it("refuses another owner's account", async () => {
  const { t, owner } = setup();
  const stranger = await t.run(
    async (ctx) => await insertAccount(ctx, "other@example.com", "someone"),
  );
  const args = { accountId: stranger, paginationOpts: page };
  await expect(owner.query(api.outbox.queries.listSent, args)).rejects.toThrow(
    "Mail account not found",
  );
  await expect(owner.query(api.mail.queries.listSpam, args)).rejects.toThrow(
    "Mail account not found",
  );
});
