import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";
import { toast } from "@rodge-mail/ui-web/toast";

import { getErrorMessage } from "./live-data-utils";

/** Retries a failed send; the row shows "Queued" before the server answers. */
export function useRetryOutbox() {
  const retryOutbox = useMutation(
    api.mail.mutations.retryOutbox,
  ).withOptimisticUpdate((store, { outboxId }) =>
    markOutboxQueued(store, outboxId),
  );
  return (outboxId: Id<"outboxMessages">) => {
    retryOutbox({ outboxId }).catch((error: unknown) => {
      toast.error(getErrorMessage(error, "Could not retry this message."));
    });
  };
}

function markOutboxQueued(
  store: OptimisticLocalStore,
  outboxId: Id<"outboxMessages">,
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
