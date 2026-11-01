import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionArgs } from "convex/server";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

export type EnqueueArgs = FunctionArgs<
  typeof api.mail.mutations.enqueuePlainText
>;

const OPTIMISTIC_PREFIX = "optimistic-";

/** The new message is in the outbox, sending, the moment Send is pressed. */
export function addSendingOutboxRow(
  store: OptimisticLocalStore,
  args: EnqueueArgs,
) {
  const account = store
    .getQuery(api.accounts.queries.list, {})
    ?.find((candidate) => candidate._id === args.accountId);
  if (!account) return;
  const now = Date.now();
  const row = {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- A placeholder ID until the server's row replaces this one.
    _id: `${OPTIMISTIC_PREFIX}${args.idempotencyKey}` as Id<"outboxMessages">,
    attempt: 0,
    cc: args.cc ?? [],
    createdAt: now,
    error: undefined,
    sentAt: undefined,
    status: "pending" as const,
    subject: args.subject,
    to: args.to,
    updatedAt: now,
  };

  const recent = store.getQuery(api.outbox.queries.listRecent, {});
  if (recent) {
    store.setQuery(api.outbox.queries.listRecent, {}, [
      {
        ...row,
        account: { address: account.address, provider: account.provider },
      },
      ...recent,
    ]);
  }
  const unsent = store.getQuery(api.outbox.queries.listUnsent, {});
  if (unsent) {
    store.setQuery(api.outbox.queries.listUnsent, {}, [
      {
        ...row,
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
        messageId: undefined,
        snippet: args.plainText.replace(/\s+/gu, " ").trim().slice(0, 160),
        threadId: undefined,
      },
      ...unsent,
    ]);
  }
}

/** A retried message shows as sending again before the server answers. */
export function markOutboxSending(
  store: OptimisticLocalStore,
  { outboxId }: { outboxId: Id<"outboxMessages"> },
) {
  function resend<T extends { _id: string; error?: string; status: string }>(
    row: T,
  ) {
    return row._id === outboxId && row.status === "failed"
      ? { ...row, error: undefined, status: "pending" as const }
      : row;
  }
  const unsent = store.getQuery(api.outbox.queries.listUnsent, {});
  if (unsent) {
    store.setQuery(api.outbox.queries.listUnsent, {}, unsent.map(resend));
  }
  const recent = store.getQuery(api.outbox.queries.listRecent, {});
  if (recent) {
    store.setQuery(api.outbox.queries.listRecent, {}, recent.map(resend));
  }
  const message = store.getQuery(api.outbox.queries.getSentMessage, {
    outboxId,
  });
  if (message) {
    store.setQuery(
      api.outbox.queries.getSentMessage,
      { outboxId },
      resend(message),
    );
  }
}

/** Placeholder rows have no server ID yet, so there is nothing to open. */
export function isOptimisticOutboxId(id: string) {
  return id.startsWith(OPTIMISTIC_PREFIX);
}

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}
