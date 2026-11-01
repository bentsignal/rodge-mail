import { useEffect, useState } from "react";
import { usePaginatedQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import { dedupeThreadRows } from "@rodge-mail/features/mail";

import type { LiveMailContextValue } from "./live-data-types";
import type { InboxMessage } from "./types";
import { MAIL_PAGE_SIZE } from "./constants";
import { useLiveMailActions } from "./live-data-actions";
import { useAccountsQuery, useUnreadCountQuery } from "./live-data-query-hooks";
import { throwQueryError, useThreadQuery } from "./live-data-support";
import { toAccountView, toUnreadCountRecord } from "./live-data-utils";
import { useMailStore } from "./store";

export function useAllMailLiveMailValue() {
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
  const page = useAllMailPage({
    accountId,
    searchQuery,
    searchTerm: debouncedSearchQuery,
  });
  const firstMessage = page.results[0];
  // eslint-disable-next-line no-restricted-syntax -- The All Mail subscription initializes the reader selection when its first result changes.
  useEffect(() => {
    if (!firstMessage) return;
    setInitialSelection({
      messageId: firstMessage._id,
      threadId: firstMessage.threadId,
    });
  }, [firstMessage, setInitialSelection]);
  const effectiveThreadId = selectedThreadId ?? firstMessage?.threadId;
  const threadQuery = useThreadQuery(effectiveThreadId);
  throwQueryError(accountQuery.error);
  throwQueryError(threadQuery.error);
  throwQueryError(unreadCountQuery.error);
  const accounts = (accountQuery.data ?? []).map(toAccountView);
  const actions = useLiveMailActions(accounts, threadQuery.data, "all");

  return {
    ...actions,
    accounts,
    canLoadMore: page.canLoadMore,
    canSeedDemo: false,
    inboxMessages: page.results,
    isLoadingAccounts: accountQuery.isPending,
    isLoadingInbox: page.isLoading,
    isLoadingMore: page.isLoadingMore,
    isLoadingUnreadCounts: unreadCountQuery.isPending,
    isLoadingThread: effectiveThreadId !== undefined && threadQuery.isPending,
    isSearchingInbox: page.isSearching,
    isSeedingDemo: false,
    loadMore: page.loadMore,
    mailMode: "all",
    selectedMessageId: selectedMessageId ?? firstMessage?._id,
    selectedThread: threadQuery.data,
    selectedThreadId: effectiveThreadId,
    unreadCounts: unreadCountQuery.data
      ? toUnreadCountRecord(unreadCountQuery.data)
      : {},
  } satisfies LiveMailContextValue;
}

function useAllMailPage({
  accountId,
  searchQuery,
  searchTerm,
}: {
  accountId: InboxMessage["accountId"] | undefined;
  searchQuery: string;
  searchTerm: string;
}) {
  const isSearching = searchTerm.length > 0;
  const allMail = usePaginatedQuery(
    api.mail.queries.listAllMail,
    isSearching ? "skip" : { accountId },
    { initialNumItems: MAIL_PAGE_SIZE },
  );
  const search = usePaginatedQuery(
    api.mail.queries.searchHeaders,
    isSearching ? { accountId, scope: "all", searchTerm } : "skip",
    { initialNumItems: MAIL_PAGE_SIZE },
  );
  const activePage = isSearching ? search : allMail;
  const isPending =
    searchQuery.trim() !== searchTerm ||
    activePage.status === "LoadingFirstPage";
  const results = dedupeThreadRows(
    useSettledResults(activePage.results, isPending),
  );
  return {
    canLoadMore: activePage.status === "CanLoadMore",
    isLoading: isPending && results.length === 0 && !isSearching,
    isLoadingMore: activePage.status === "LoadingMore",
    isSearching: isSearching && isPending,
    loadMore: () => activePage.loadMore(MAIL_PAGE_SIZE),
    results,
  };
}

function useSettledResults(results: InboxMessage[], isPending: boolean) {
  const [settled, setSettled] = useState<InboxMessage[]>();
  // eslint-disable-next-line no-restricted-syntax -- Keep the last settled page on screen while the next Convex subscription loads.
  useEffect(() => {
    if (isPending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Query settlement is an external subscription snapshot.
    setSettled(results);
  }, [isPending, results]);
  if (!isPending) return results;
  return settled ?? results;
}
