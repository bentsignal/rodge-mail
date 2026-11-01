/* eslint-disable @typescript-eslint/consistent-type-assertions -- The fake store and branded IDs are compile-time-only in this test. */
import type { OptimisticLocalStore } from "convex/browser";
import { getFunctionName } from "convex/server";
import { expect, it } from "vitest";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import { optimisticallyRemoveAccount } from "./account-removal-optimistic";

type Ref = Parameters<typeof getFunctionName>[0];

function createStore(queries: Record<string, unknown[]>) {
  const values = new Map(
    Object.entries(queries).map(([name, list]) => [name, list]),
  );
  const store = {
    getQuery: (query: Ref) => values.get(getFunctionName(query))?.[0],
    getAllQueries: (query: Ref) =>
      (values.get(getFunctionName(query)) ?? []).map((value) => ({
        args: {},
        value,
      })),
    setQuery: (query: Ref, _args: unknown, value: unknown) =>
      values.set(getFunctionName(query), [value]),
  } as unknown as OptimisticLocalStore;
  return { store, read: (query: Ref) => values.get(getFunctionName(query)) };
}

const GONE = "account-gone" as Id<"mailAccounts">;
const KEPT = "account-kept" as Id<"mailAccounts">;
function row(accountId: string) {
  return { accountId };
}

function outboxRow(accountId: string) {
  return { account: { _id: accountId } };
}

it("removes the account and its rows from every loaded list", () => {
  const { store, read } = createStore({
    [getFunctionName(api.accounts.queries.list)]: [
      [
        { _id: GONE, address: "gone@example.com" },
        { _id: KEPT, address: "kept@example.com" },
      ],
    ],
    [getFunctionName(api.mail.queries.listInbox)]: [
      { isDone: false, page: [row(GONE), row(KEPT)] },
    ],
    [getFunctionName(api.mail.queries.getMessagesByIds)]: [[row(GONE)]],
    [getFunctionName(api.outbox.queries.listUnsent)]: [
      [outboxRow(GONE), outboxRow(KEPT)],
    ],
    [getFunctionName(api.outbox.queries.listRecent)]: [
      [{ account: { address: "gone@example.com" } }],
    ],
    [getFunctionName(api.mail.queries.getUnreadCounts)]: [
      { all: 5, byAccount: { [GONE]: 3, [KEPT]: 2 } },
    ],
  });

  optimisticallyRemoveAccount(store, { accountId: GONE });

  expect(read(api.accounts.queries.list)).toEqual([
    [{ _id: KEPT, address: "kept@example.com" }],
  ]);
  expect(read(api.mail.queries.listInbox)).toEqual([
    { isDone: false, page: [row(KEPT)] },
  ]);
  expect(read(api.mail.queries.getMessagesByIds)).toEqual([[]]);
  expect(read(api.outbox.queries.listUnsent)).toEqual([[outboxRow(KEPT)]]);
  expect(read(api.outbox.queries.listRecent)).toEqual([[]]);
  expect(read(api.mail.queries.getUnreadCounts)).toEqual([
    { all: 2, byAccount: { [KEPT]: 2 } },
  ]);
});
