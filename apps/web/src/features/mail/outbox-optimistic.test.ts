/* eslint-disable @typescript-eslint/consistent-type-assertions -- The fake store and branded IDs are compile-time-only in this test. */
import type { OptimisticLocalStore } from "convex/browser";
import { getFunctionName } from "convex/server";
import { describe, expect, it } from "vitest";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import type { EnqueueArgs } from "./outbox-optimistic";
import {
  addSendingOutboxRow,
  isOptimisticOutboxId,
  markOutboxSending,
} from "./outbox-optimistic";

function createStore(queries: Record<string, unknown>) {
  const values = new Map(Object.entries(queries));
  const store = {
    getQuery: (query: Parameters<typeof getFunctionName>[0]) =>
      values.get(getFunctionName(query)),
    setQuery: (
      query: Parameters<typeof getFunctionName>[0],
      _args: unknown,
      value: unknown,
    ) => values.set(getFunctionName(query), value),
  } as unknown as OptimisticLocalStore;
  return { store, values };
}

const ACCOUNT = {
  _id: "account-1",
  address: "alex@example.com",
  displayLabel: "Personal",
  provider: "gmail",
};

const ARGS = {
  accountId: "account-1" as Id<"mailAccounts">,
  attachmentIds: ["draft-1" as Id<"draftAttachments">],
  idempotencyKey: "rodge-web-key",
  plainText: "Are you free\n\nfor lunch?",
  subject: "Lunch",
  to: [{ address: "jordan@example.com" }],
} satisfies EnqueueArgs;

const RECENT = getFunctionName(api.outbox.queries.listRecent);
const UNSENT = getFunctionName(api.outbox.queries.listUnsent);

describe("optimistic outbox rows", () => {
  it("puts a sending row at the top of the outbox lists", () => {
    const { store, values } = createStore({
      [getFunctionName(api.accounts.queries.list)]: [ACCOUNT],
      [RECENT]: [{ _id: "older" }],
      [UNSENT]: [{ _id: "older" }],
    });

    addSendingOutboxRow(store, ARGS);

    const [recent] = values.get(RECENT) as { _id: string; status: string }[];
    const [unsent] = values.get(UNSENT) as {
      _id: string;
      account: { label: string };
      attachmentCount: number;
      snippet: string;
      status: string;
    }[];
    expect(recent).toMatchObject({ status: "pending", subject: "Lunch" });
    expect(isOptimisticOutboxId(recent?._id ?? "")).toBe(true);
    expect(unsent).toMatchObject({
      account: { label: "Personal" },
      attachmentCount: 1,
      snippet: "Are you free for lunch?",
      status: "pending",
    });
    expect(values.get(UNSENT)).toHaveLength(2);
  });

  it("leaves the lists alone when the account isn't loaded", () => {
    const { store, values } = createStore({ [RECENT]: [] });

    addSendingOutboxRow(store, ARGS);

    expect(values.get(RECENT)).toEqual([]);
  });

  it("shows a retried message as sending again", () => {
    const { store, values } = createStore({
      [RECENT]: [
        { _id: "failed", error: "Nope", status: "failed" },
        { _id: "sent", status: "sent" },
      ],
    });

    markOutboxSending(store, { outboxId: "failed" as Id<"outboxMessages"> });

    expect(values.get(RECENT)).toEqual([
      { _id: "failed", error: undefined, status: "pending" },
      { _id: "sent", status: "sent" },
    ]);
  });
});
