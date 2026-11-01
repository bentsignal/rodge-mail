import { useEffect } from "react";
// eslint-disable-next-line no-restricted-imports -- Spam selection loads its thread independently from inbox pagination.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { usePaginatedQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { LiveMailContextValue } from "./live-data-types";
import { MAIL_PAGE_SIZE } from "./constants";
import { useLiveMailActions } from "./live-data-actions";
import { useAccountsQuery, useUnreadCountQuery } from "./live-data-query-hooks";
import { useSettledResults } from "./live-data-support";
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
  const spamPage = useSpamPage();
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
    select: (thread) => thread ?? undefined,
  });
  throwQueryError(accountQuery.error);
  throwQueryError(threadQuery.error);
  throwQueryError(unreadCountQuery.error);
  const accounts = (accountQuery.data ?? []).map(toAccountView);
  const actions = useLiveMailActions(accounts, threadQuery.data, "spam");

  return {
    ...actions,
    accounts,
    canLoadMore: spamPage.canLoadMore,
    canSeedDemo: false,
    inboxMessages,
    isLoadingAccounts: accountQuery.isPending,
    isLoadingInbox: spamPage.isLoading,
    isLoadingMore: spamPage.isLoadingMore,
    isLoadingUnreadCounts: unreadCountQuery.isPending,
    isLoadingThread: effectiveThreadId !== undefined && threadQuery.isPending,
    isSearchingInbox: false,
    isSeedingDemo: false,
    loadMore: spamPage.loadMore,
    mailMode: "spam",
    selectedMessageId: effectiveMessage?._id,
    selectedThread: threadQuery.data,
    selectedThreadId: effectiveThreadId,
    unreadCounts: unreadCountQuery.data
      ? toUnreadCountRecord(unreadCountQuery.data)
      : {},
  } satisfies LiveMailContextValue;
}

function useSpamPage() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const accountId = accountFilter === "all" ? undefined : accountFilter;
  const page = usePaginatedQuery(
    api.mail.queries.listSpam,
    { accountId },
    {
      initialNumItems: MAIL_PAGE_SIZE,
    },
  );
  const isPending = page.status === "LoadingFirstPage";
  const results = useSettledResults(page.results, isPending, accountId);
  const needsMoreRows =
    accountId !== undefined &&
    page.status === "CanLoadMore" &&
    page.results.length < MAIL_PAGE_SIZE;
  const { loadMore } = page;
  // eslint-disable-next-line no-restricted-syntax -- One account's spam can come back short (listSpam filters after reading), and a short list has nothing to scroll for more.
  useEffect(() => {
    if (needsMoreRows) loadMore(MAIL_PAGE_SIZE);
  }, [loadMore, needsMoreRows]);
  return {
    canLoadMore: page.status === "CanLoadMore",
    isLoading: (isPending || needsMoreRows) && results.length === 0,
    isLoadingMore: page.status === "LoadingMore",
    loadMore: () => loadMore(MAIL_PAGE_SIZE),
    results,
  };
}

function throwQueryError(error: Error | null) {
  if (error) throw error;
}
