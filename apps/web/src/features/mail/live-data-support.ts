import { useEffect, useState } from "react";
// eslint-disable-next-line no-restricted-imports -- The selected thread is loaded independently from the paginated mailbox.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";

import { api } from "@rodge-mail/convex/api";

import type { InboxMessage, MailAccountDocument } from "./types";
import { env } from "~/env";

export function canSeedDemoMail(accounts: MailAccountDocument[] | undefined) {
  return env.VITE_NODE_ENV === "development" && accounts?.length === 0;
}

export function useThreadQuery(threadId: InboxMessage["threadId"] | undefined) {
  return useQuery({
    ...convexQuery(
      api.mail.queries.getThread,
      threadId ? { threadId } : "skip",
    ),
    select: (thread) => thread ?? undefined,
  });
}

export function throwQueryError(error: Error | null) {
  if (error) throw error;
}

/**
 * Keeps the last settled page on screen while the next Convex subscription
 * loads, narrowed to the account being switched to.
 */
export function useSettledResults<T extends { accountId: string }>(
  results: T[],
  isPending: boolean,
  accountId: string | undefined,
) {
  const [settled, setSettled] = useState<T[]>();
  // eslint-disable-next-line no-restricted-syntax -- Keep the last settled page on screen while the next Convex subscription loads.
  useEffect(() => {
    if (isPending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Query settlement is an external subscription snapshot.
    setSettled(results);
  }, [isPending, results]);
  if (!isPending) return results;
  const rows = settled ?? results;
  return accountId ? rows.filter((row) => row.accountId === accountId) : rows;
}
