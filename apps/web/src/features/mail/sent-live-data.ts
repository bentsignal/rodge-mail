// eslint-disable-next-line no-restricted-imports -- The selected sent message and its thread load independently from the sent list.
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import type { LiveMailContextValue } from "./live-data-types";
import { useLiveMailActions } from "./live-data-actions";
import { useAccountsQuery, useUnreadCountQuery } from "./live-data-query-hooks";
import { throwQueryError, useThreadQuery } from "./live-data-support";
import { toAccountView, toUnreadCountRecord } from "./live-data-utils";

export function useSelectedOutboxId() {
  const outboxId = useParams({
    select: (params) => params.outboxId,
    strict: false,
  });
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Convex validates the route-derived ID at the query boundary.
  return outboxId as Id<"outboxMessages"> | undefined;
}

export function useSentMessageQuery(outboxId: Id<"outboxMessages"> | undefined) {
  return useQuery({
    ...convexQuery(
      api.outbox.queries.getSentMessage,
      outboxId ? { outboxId } : "skip",
    ),
    select: (message) => message,
  });
}

/**
 * The Sent view: the reader shows the thread of the selected sent message
 * once its provider copy is in the mailbox.
 */
export function useSentLiveMailValue() {
  const outboxId = useSelectedOutboxId();
  const accountQuery = useAccountsQuery();
  const unreadCountQuery = useUnreadCountQuery();
  const sentQuery = useSentMessageQuery(outboxId);
  const threadId = sentQuery.data?.threadId;
  const threadQuery = useThreadQuery(threadId);
  throwQueryError(accountQuery.error);
  throwQueryError(sentQuery.error);
  throwQueryError(threadQuery.error);
  throwQueryError(unreadCountQuery.error);
  const accounts = (accountQuery.data ?? []).map(toAccountView);
  const actions = useLiveMailActions(accounts, threadQuery.data, "sent");

  return {
    ...actions,
    accounts,
    canLoadMore: false,
    canSeedDemo: false,
    inboxMessages: [],
    isLoadingAccounts: accountQuery.isPending,
    isLoadingInbox: false,
    isLoadingMore: false,
    isLoadingUnreadCounts: unreadCountQuery.isPending,
    isLoadingThread: threadId !== undefined && threadQuery.isPending,
    isSearchingInbox: false,
    isSeedingDemo: false,
    loadMore: () => undefined,
    mailMode: "sent",
    selectedMessageId: sentQuery.data?.messageId,
    selectedThread: threadQuery.data,
    selectedThreadId: threadId,
    unreadCounts: unreadCountQuery.data
      ? toUnreadCountRecord(unreadCountQuery.data)
      : {},
  } satisfies LiveMailContextValue;
}
