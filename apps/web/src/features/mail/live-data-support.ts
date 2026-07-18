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
    select: (thread) => thread,
  });
}

export function throwQueryError(error: Error | null) {
  if (error) throw error;
}
