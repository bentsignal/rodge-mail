// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Seeded } from "./removal.fixtures";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { REMOVAL_MESSAGE_BATCH_SIZE } from "./removal";
import { OWNER, seedAccount, sesIdFor } from "./removal.fixtures";

vi.mock("../convex.env", () => ({
  env: { AUTH_ALLOWED_USER_ID: "owner" },
}));

const modules = import.meta.glob("/src/**/*.ts");

function setupConvex() {
  const t = convexTest(schema, modules);
  return { t, owner: t.withIdentity({ subject: OWNER }) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const ACCOUNT_TABLES = [
  "mailFolders",
  "threads",
  "messages",
  "archivedMessageTombstones",
  "mailingListSuppressions",
  "messageEmbeddingJobs",
  "messageEmbeddings",
  "syncRuns",
  "providerCredentials",
  "outboxMessages",
  "hostedAddresses",
  "accountNotificationPreferences",
] as const satisfies TableNames[];

const MESSAGE_TABLES = [
  "messageContents",
  "attachments",
  "messageClassifications",
  "messageCleanViews",
  "notificationDeliveries",
] as const satisfies TableNames[];

/** Rows (and stored files) still belonging to a seeded account, per table. */
async function countOwnedRows(ctx: MutationCtx, seeded: Seeded) {
  const counts = new Map<string, number>();
  for (const table of ACCOUNT_TABLES) {
    const rows = await ctx.db.query(table).collect();
    counts.set(
      table,
      rows.filter((row) => row.accountId === seeded.accountId).length,
    );
  }
  const messageIds = new Set<string>(seeded.messageIds);
  for (const table of MESSAGE_TABLES) {
    const rows = await ctx.db.query(table).collect();
    counts.set(
      table,
      rows.filter((row) => messageIds.has(row.messageId)).length,
    );
  }
  const deliveryIds = new Set<string>(
    (await ctx.db.query("notificationDeliveries").collect())
      .filter((row) => messageIds.has(row.messageId))
      .map((row) => row._id),
  );
  const tickets = await ctx.db.query("notificationPushTickets").collect();
  counts.set(
    "notificationPushTickets",
    tickets.filter((row) => deliveryIds.has(row.deliveryId)).length,
  );
  const files = await Promise.all(
    seeded.storageIds.map(async (id) => await ctx.db.system.get(id)),
  );
  counts.set("storage", files.filter(Boolean).length);
  counts.set("mailAccounts", (await ctx.db.get(seeded.accountId)) ? 1 : 0);
  return Object.fromEntries(counts);
}

function zeroCounts(counts: Record<string, number>) {
  return Object.fromEntries(Object.keys(counts).map((key) => [key, 0]));
}

it("deletes every row an account owns and leaves other accounts alone", async () => {
  const { t, owner } = setupConvex();
  const { removed, kept } = await t.run(async (ctx) => ({
    removed: await seedAccount(ctx, {
      address: "me@rodge.example",
      provider: "hosted",
      messageCount: 3,
    }),
    kept: await seedAccount(ctx, {
      address: "keep@example.com",
      provider: "gmail",
      messageCount: 2,
    }),
  }));
  const keptBefore = await t.run(async (ctx) => countOwnedRows(ctx, kept));

  await owner.mutation(api.accounts.mutations.remove, {
    accountId: removed.accountId,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const removedAfter = await t.run(async (ctx) => countOwnedRows(ctx, removed));
  expect(removedAfter).toEqual(zeroCounts(removedAfter));
  expect(await t.run(async (ctx) => countOwnedRows(ctx, kept))).toEqual(
    keptBefore,
  );
  await t.run(async (ctx) => {
    const domain = await ctx.db.query("hostedDomains").unique();
    expect(domain?.domain).toBe("rodge.example");
    expect(domain?.catchAllAccountId).toBeUndefined();
    const events = await ctx.db.query("hostedDeliveryEvents").collect();
    expect(events.map((event) => event.sesMessageId)).toEqual([
      sesIdFor("keep@example.com"),
    ]);
  });
});

it("hides the account and its mail before the batches run", async () => {
  const { t, owner } = setupConvex();
  const { removed, kept } = await t.run(async (ctx) => ({
    removed: await seedAccount(ctx, {
      address: "gone@example.com",
      provider: "gmail",
      messageCount: 2,
    }),
    kept: await seedAccount(ctx, {
      address: "keep@example.com",
      provider: "gmail",
      messageCount: 1,
    }),
  }));

  await owner.mutation(api.accounts.mutations.remove, {
    accountId: removed.accountId,
  });

  const accounts = await owner.query(api.accounts.queries.list, {});
  expect(accounts.map((account) => account._id)).toEqual([kept.accountId]);
  const inbox = await owner.query(api.mail.queries.listInbox, {
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(inbox.page.map((item) => item.accountId)).toEqual([kept.accountId]);
  expect(await owner.query(api.mail.queries.getUnreadCounts, {})).toEqual({
    all: 1,
    byAccount: { [kept.accountId]: 1 },
  });
  const filtered = await owner.query(api.mail.queries.listInbox, {
    accountId: removed.accountId,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(filtered.page).toEqual([]);
  await expect(
    owner.query(api.mail.queries.getThread, { threadId: removed.threadId }),
  ).rejects.toThrow("Thread not found");
  expect(
    await t.query(internal.sync.internal.getGmailSyncContext, {
      ownerId: OWNER,
      accountId: removed.accountId,
    }),
  ).toBeNull();
  const scheduled = await t.query(
    internal.sync.internal.listScheduledGmailAccounts,
    {},
  );
  expect(scheduled.map((account) => account.accountId)).toEqual([
    kept.accountId,
  ]);
});

it("drops provider writes and inbound hosted mail once removal starts", async () => {
  const { t, owner } = setupConvex();
  const removed = await t.run(async (ctx) =>
    seedAccount(ctx, {
      address: "me@rodge.example",
      provider: "hosted",
      messageCount: 1,
    }),
  );

  await owner.mutation(api.accounts.mutations.remove, {
    accountId: removed.accountId,
  });

  expect(
    await t.query(internal.providers.hosted.internal.resolveRecipients, {
      recipients: [
        "me@rodge.example",
        "alias@rodge.example",
        "other@rodge.example",
      ],
    }),
  ).toEqual([]);
  await expect(
    t.mutation(internal.sync.internal.upsertProviderFolder, {
      ownerId: OWNER,
      accountId: removed.accountId,
      remoteFolderId: "NEW",
      name: "New",
      kind: "custom",
    }),
  ).rejects.toThrow("Mail account not found");
});

it("finishes a mailbox larger than one batch across several runs", async () => {
  const { t, owner } = setupConvex();
  const messageCount = REMOVAL_MESSAGE_BATCH_SIZE * 2 + 5;
  const removed = await t.run(async (ctx) =>
    seedAccount(ctx, {
      address: "big@example.com",
      provider: "gmail",
      messageCount,
    }),
  );

  await owner.mutation(api.accounts.mutations.remove, {
    accountId: removed.accountId,
  });
  expect(
    await t.mutation(internal.accounts.removal.removeAccountBatch, {
      accountId: removed.accountId,
    }),
  ).toEqual({ done: false });
  const remaining = await t.run(async (ctx) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_account_received", (q) =>
        q.eq("accountId", removed.accountId),
      )
      .collect();
    return messages.length;
  });
  expect(remaining).toBe(messageCount - REMOVAL_MESSAGE_BATCH_SIZE);

  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const after = await t.run(async (ctx) => countOwnedRows(ctx, removed));
  expect(after).toEqual(zeroCounts(after));
  const filtered = await owner.query(api.mail.queries.listInbox, {
    accountId: removed.accountId,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(filtered.page).toEqual([]);
});

it("only removes the owner's own accounts", async () => {
  const { t } = setupConvex();
  const removed = await t.run(async (ctx) =>
    seedAccount(ctx, {
      address: "me@example.com",
      provider: "gmail",
      messageCount: 1,
    }),
  );

  await expect(
    t
      .withIdentity({ subject: "someone-else" })
      .mutation(api.accounts.mutations.remove, {
        accountId: removed.accountId,
      }),
  ).rejects.toThrow();
  const account = await t.run(async (ctx) => ctx.db.get(removed.accountId));
  expect(account?.deletingAt).toBeUndefined();
});
