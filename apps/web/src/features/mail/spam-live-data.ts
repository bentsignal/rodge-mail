// eslint-disable-next-line no-restricted-imports -- Spam selection loads its thread independently from inbox pagination.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { usePaginatedQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { LiveMailContextValue } from "./live-data-types";
import { MAIL_PAGE_SIZE } from "./constants";
import { useLiveMailActions } from "./live-data-actions";
import { useAccountsQuery, useUnreadCountQuery } from "./live-data-query-hooks";
import {
  sortInboxMessages,
  toAccountView,
  toUnreadCountRecord,
} from "./live-data-utils";
import { useMailStore } from "./store";

export function useSpamLiveMailValue() {
  const selectedMessageId = useMailStore((store) => store.selectedMessageId);
  const selectedThreadId = useMailStore((store) => store.selectedThreadId);
  const accountQuery = useAccountsQuery();
  const unreadCountQuery = useUnreadCountQuery();
  const spamPage = usePaginatedQuery(
    api.mail.queries.listSpam,
    {},
    {
      initialNumItems: MAIL_PAGE_SIZE,
    },
  );
  const inboxMessages = sortInboxMessages(spamPage.results);
  const firstMessage = inboxMessages[0];
  const selectedSpamMessage = inboxMessages.find(
    (message) =>
      message._id === selectedMessageId &&
      message.threadId === selectedThreadId,
  );
  const effectiveMessage = selectedSpamMessage ?? firstMessage;
  const effectiveThreadId = effectiveMessage?.threadId;
  const threadQuery = useQuery({
    ...convexQuery(
      api.mail.queries.getThread,
      effectiveThreadId ? { threadId: effectiveThreadId } : "skip",
    ),
    select: (thread) => thread,
  });
  throwQueryError(accountQuery.error);
  throwQueryError(threadQuery.error);
  throwQueryError(unreadCountQuery.error);
  const accounts = (accountQuery.data ?? []).map(toAccountView);
  const actions = useLiveMailActions(accounts, threadQuery.data, "spam");

  return {
    ...actions,
    accounts,
    canLoadMore: spamPage.status === "CanLoadMore",
    canSeedDemo: false,
    inboxMessages,
    isLoadingAccounts: accountQuery.isPending,
    isLoadingInbox: spamPage.status === "LoadingFirstPage",
    isLoadingMore: spamPage.status === "LoadingMore",
    isLoadingUnreadCounts: unreadCountQuery.isPending,
    isLoadingThread: effectiveThreadId !== undefined && threadQuery.isPending,
    isSearchingInbox: false,
    isSeedingDemo: false,
    loadMore: () => spamPage.loadMore(MAIL_PAGE_SIZE),
    mailMode: "spam",
    selectedMessageId: effectiveMessage?._id,
    selectedThread: threadQuery.data,
    selectedThreadId: effectiveThreadId,
    unreadCounts: unreadCountQuery.data
      ? toUnreadCountRecord(unreadCountQuery.data)
      : {},
  } satisfies LiveMailContextValue;
}

function throwQueryError(error: Error | null) {
  if (error) throw error;
}
