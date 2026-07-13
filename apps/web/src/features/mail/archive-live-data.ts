import { useEffect } from "react";
// eslint-disable-next-line no-restricted-imports -- Archive selection loads its thread independently from the inbox provider.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { usePaginatedQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { LiveMailContextValue } from "./live-data-types";
import type { InboxMessage } from "./types";
import { MAIL_PAGE_SIZE } from "./constants";
import { useLiveMailActions } from "./live-data-actions";
import { useAccountsQuery, useUnreadCountQuery } from "./live-data-query-hooks";
import { toAccountView, toUnreadCountRecord } from "./live-data-utils";
import { useMailStore } from "./store";

export function useArchiveLiveMailValue() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const debouncedSearchQuery = useMailStore(
    (store) => store.debouncedSearchQuery,
  );
  const searchQuery = useMailStore((store) => store.searchQuery);
  const selectedMessageId = useMailStore((store) => store.selectedMessageId);
  const selectedThreadId = useMailStore((store) => store.selectedThreadId);
  const setInitialSelection = useMailStore(
    (store) => store.setInitialSelection,
  );
  const accountId = accountFilter === "all" ? undefined : accountFilter;
  const accountQuery = useAccountsQuery();
  const unreadCountQuery = useUnreadCountQuery();
  const archivePage = useArchiveMailboxPage({
    accountId,
    searchQuery,
    searchTerm: debouncedSearchQuery,
  });
  const inboxMessages = archivePage.results;
  const firstMessage = inboxMessages[0];
  // eslint-disable-next-line no-restricted-syntax -- The archive subscription initializes the reader selection when its first result changes.
  useEffect(() => {
    if (!firstMessage) return;
    setInitialSelection({
      messageId: firstMessage._id,
      threadId: firstMessage.threadId,
    });
  }, [firstMessage, setInitialSelection]);
  const effectiveThreadId = selectedThreadId ?? firstMessage?.threadId;
  const threadQuery = useArchiveThreadQuery(effectiveThreadId);
  throwQueryError(accountQuery.error);
  throwQueryError(threadQuery.error);
  throwQueryError(unreadCountQuery.error);
  const accounts = (accountQuery.data ?? []).map(toAccountView);
  const actions = useLiveMailActions(accounts, threadQuery.data, "archive");

  return {
    ...actions,
    accounts,
    canLoadMore: archivePage.canLoadMore,
    canSeedDemo: false,
    inboxMessages,
    isLoadingAccounts: accountQuery.isPending,
    isLoadingInbox: archivePage.isLoading,
    isLoadingMore: archivePage.isLoadingMore,
    isLoadingThread: effectiveThreadId !== undefined && threadQuery.isPending,
    isSearchingInbox: archivePage.isSearching,
    isSeedingDemo: false,
    loadMore: archivePage.loadMore,
    mailMode: "archive",
    selectedMessageId: selectedMessageId ?? firstMessage?._id,
    selectedThread: threadQuery.data,
    selectedThreadId: effectiveThreadId,
    unreadCounts: unreadCountQuery.data
      ? toUnreadCountRecord(unreadCountQuery.data)
      : {},
  } satisfies LiveMailContextValue;
}

function useArchiveMailboxPage({
  accountId,
  searchQuery,
  searchTerm,
}: {
  accountId: InboxMessage["accountId"] | undefined;
  searchQuery: string;
  searchTerm: string;
}) {
  const isSearching = searchTerm.length > 0;
  const archive = usePaginatedQuery(
    api.mail.archiveQueries.listArchive,
    isSearching ? "skip" : { accountId },
    { initialNumItems: MAIL_PAGE_SIZE },
  );
  const search = useQuery({
    ...convexQuery(
      api.mail.archiveQueries.searchArchive,
      isSearching ? { accountId, searchTerm } : "skip",
    ),
    select: (results) => results,
  });
  const isWaitingForDebounce = searchQuery.trim() !== searchTerm;
  return {
    canLoadMore: !isSearching && archive.status === "CanLoadMore",
    isLoading:
      isWaitingForDebounce ||
      (isSearching ? search.isPending : archive.status === "LoadingFirstPage"),
    isLoadingMore: !isSearching && archive.status === "LoadingMore",
    isSearching: isSearching && search.isPending,
    loadMore: () => archive.loadMore(MAIL_PAGE_SIZE),
    results: isSearching ? (search.data ?? []) : archive.results,
  };
}

function useArchiveThreadQuery(threadId: InboxMessage["threadId"] | undefined) {
  return useQuery({
    ...convexQuery(
      api.mail.queries.getThread,
      threadId ? { threadId } : "skip",
    ),
    select: (thread) => thread,
  });
}

function throwQueryError(error: Error | null) {
  if (error) throw error;
}
