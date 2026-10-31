import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionArgs } from "convex/server";

import type { Doc, Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import { toConvexId } from "../lib/convex-id";

export type EnqueueArgs = FunctionArgs<
  typeof api.mail.mutations.enqueuePlainText
>;

/** The new message is in the outbox the moment Send is tapped. */
export function addQueuedOutboxRow(
  store: OptimisticLocalStore,
  args: EnqueueArgs,
) {
  const unsent = store.getQuery(api.outbox.queries.listUnsent, {});
  if (!unsent) return;
  const account = store
    .getQuery(api.accounts.queries.list, {})
    ?.find((candidate) => candidate._id === args.accountId);
  if (!account) return;
  store.setQuery(api.outbox.queries.listUnsent, {}, [
    toQueuedRow(args, account, Date.now()),
    ...unsent,
  ]);
}

function toQueuedRow(
  args: EnqueueArgs,
  account: Pick<
    Doc<"mailAccounts">,
    "_id" | "address" | "displayLabel" | "displayName" | "provider"
  >,
  now: number,
) {
  return {
    _id: toConvexId<"outboxMessages">(`optimistic-${args.idempotencyKey}`),
    account: {
      _id: account._id,
      address: account.address,
      label:
        nonEmpty(account.displayLabel) ??
        nonEmpty(account.displayName) ??
        account.address,
      provider: account.provider,
    },
    attachmentCount: args.attachmentIds?.length ?? 0,
    attempt: 0,
    cc: args.cc ?? [],
    createdAt: now,
    error: undefined,
    messageId: undefined,
    sentAt: undefined,
    snippet: args.plainText.replace(/\s+/gu, " ").trim().slice(0, 160),
    status: "pending" as const,
    subject: args.subject,
    threadId: undefined,
    to: args.to,
    updatedAt: now,
  };
}

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

/** A retried message shows as queued again before the server answers. */
export function markOutboxQueued(
  store: OptimisticLocalStore,
  { outboxId }: { outboxId: Id<"outboxMessages"> },
) {
  function queue<T extends { _id: string; error?: string; status: string }>(
    row: T,
  ) {
    return row._id === outboxId && row.status === "failed"
      ? { ...row, error: undefined, status: "pending" as const }
      : row;
  }
  const unsent = store.getQuery(api.outbox.queries.listUnsent, {});
  if (unsent) {
    store.setQuery(api.outbox.queries.listUnsent, {}, unsent.map(queue));
  }
  const recent = store.getQuery(api.outbox.queries.listRecent, {});
  if (recent) {
    store.setQuery(api.outbox.queries.listRecent, {}, recent.map(queue));
  }
  const message = store.getQuery(api.outbox.queries.getSentMessage, {
    outboxId,
  });
  if (message) {
    store.setQuery(
      api.outbox.queries.getSentMessage,
      { outboxId },
      queue(message),
    );
  }
}

export function isOptimisticOutboxId(id: string) {
  return id.startsWith("optimistic-");
}
