import { createContext, use, useEffect } from "react";
// eslint-disable-next-line no-restricted-imports -- Mail has intentional loading states and a selection-dependent thread query.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";

import { api } from "@rodge-mail/convex/api";

import type { LiveMailContextValue } from "./live-data-types";
import type { MailAccountFilter } from "./store";
import type { InboxMessage, MailAccountDocument } from "./types";
import { env } from "~/env";
import { useArchiveLiveMailValue } from "./archive-live-data";
import { MAIL_PAGE_SIZE } from "./constants";
import { useLiveMailActions } from "./live-data-actions";
import { useAccountsQuery, useUnreadCountQuery } from "./live-data-query-hooks";
import {
  sortInboxMessages,
  toAccountView,
  toUnreadCountRecord,
} from "./live-data-utils";
import {
  getIsLoadingInbox,
  getIsSearchingInbox,
  useMailboxPage,
} from "./mailbox-page";
import { useMailStore } from "./store";
import { useUnreadSelectionSync } from "./use-unread-selection-sync";

const LiveMailContext = createContext<LiveMailContextValue | undefined>(
  undefined,
);

export function LiveMailProvider({
  children,
  initialAccountFilter,
  initialInbox,
  initialUnreadOnly,
}: {
  children: React.ReactNode;
  initialAccountFilter: MailAccountFilter;
  initialInbox: InboxMessage[];
  initialUnreadOnly: boolean;
}) {
  const value = useLiveMailValue({
    initialAccountFilter,
    initialInbox,
    initialUnreadOnly,
  });
  return (
    <LiveMailContext.Provider value={value}>
      {children}
    </LiveMailContext.Provider>
  );
}

export function ArchiveLiveMailProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useArchiveLiveMailValue();
  return (
    <LiveMailContext.Provider value={value}>
      {children}
    </LiveMailContext.Provider>
  );
}

export function useLiveMail() {
  const context = use(LiveMailContext);
  if (!context) {
    throw new Error("useLiveMail must be used within LiveMailProvider");
  }
  return context;
}

function useLiveMailValue({
  initialAccountFilter,
  initialInbox,
  initialUnreadOnly,
}: {
  initialAccountFilter: MailAccountFilter;
  initialInbox: InboxMessage[];
  initialUnreadOnly: boolean;
}) {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const debouncedSearchQuery = useMailStore(
    (store) => store.debouncedSearchQuery,
  );
  const searchQuery = useMailStore((store) => store.searchQuery);
  const selectedMessageId = useMailStore((store) => store.selectedMessageId);
  const selectedThreadId = useMailStore((store) => store.selectedThreadId);
  const unreadOnly = useMailStore((store) => store.unreadOnly);
  const setInitialSelection = useMailStore(
    (store) => store.setInitialSelection,
  );
  const queryState = useLiveMailQueries({
    accountFilter,
    debouncedSearchQuery,
    searchQuery,
    selectedMessageId,
    selectedThreadId,
    initialInbox,
    initialAccountFilter,
    initialUnreadOnly,
    unreadOnly,
  });
  const firstMessage = queryState.inboxMessages[0];
  // eslint-disable-next-line no-restricted-syntax -- The live query's first result initializes stable local selection once per view.
  useEffect(() => {
    if (!firstMessage) return;
    setInitialSelection({
      messageId: firstMessage._id,
      threadId: firstMessage.threadId,
    });
  }, [firstMessage, setInitialSelection]);
  useUnreadSelectionSync({
    inboxMessages: queryState.inboxMessages,
    isLoadingInbox: queryState.isLoadingInbox,
    isLoadingThread: queryState.isLoadingThread,
    selectedThread: queryState.selectedThread,
    selectedThreadId,
    unreadOnly,
  });
  const actions = useLiveMailActions(
    queryState.accounts,
    queryState.selectedThread,
    "inbox",
  );

  return {
    ...actions,
    ...queryState,
    mailMode: "inbox",
  } satisfies LiveMailContextValue;
}

function useLiveMailQueries({
  accountFilter,
  debouncedSearchQuery,
  searchQuery,
  selectedMessageId,
  selectedThreadId,
  initialInbox,
  initialAccountFilter,
  initialUnreadOnly,
  unreadOnly,
}: {
  accountFilter: MailAccountFilter;
  debouncedSearchQuery: string;
  searchQuery: string;
  selectedMessageId: InboxMessage["_id"] | undefined;
  selectedThreadId: InboxMessage["threadId"] | undefined;
  initialInbox: InboxMessage[];
  initialAccountFilter: MailAccountFilter;
  initialUnreadOnly: boolean;
  unreadOnly: boolean;
}) {
  const accountId = accountFilter === "all" ? undefined : accountFilter;
  const accountQuery = useAccountsQuery();
  const unreadCountQuery = useUnreadCountQuery();
  const activePage = useMailboxPage({
    accountId,
    initialAccountId:
      initialAccountFilter === "all" ? undefined : initialAccountFilter,
    initialInbox,
    initialUnreadOnly,
    searchTerm: debouncedSearchQuery,
    unreadOnly,
  });
  const inboxMessages = sortInboxMessages(activePage.results);
  const effectiveThreadId = selectedThreadId ?? inboxMessages[0]?.threadId;
  const threadQuery = useThreadQuery(effectiveThreadId);
  throwQueryError(accountQuery.error);
  throwQueryError(threadQuery.error);
  throwQueryError(unreadCountQuery.error);

  return {
    accounts: (accountQuery.data ?? []).map(toAccountView),
    canLoadMore: activePage.status === "CanLoadMore",
    canSeedDemo: canSeedDemoMail(accountQuery.data),
    inboxMessages,
    isLoadingAccounts: accountQuery.isPending,
    isLoadingInbox: getIsLoadingInbox({
      debouncedSearchQuery,
      hasCachedPage: activePage.hasCachedPage,
      pageStatus: activePage.status,
      searchQuery,
    }),
    isLoadingMore: activePage.status === "LoadingMore",
    isSearchingInbox: getIsSearchingInbox({
      debouncedSearchQuery,
      pageStatus: activePage.status,
      searchQuery,
    }),
    isLoadingThread: effectiveThreadId !== undefined && threadQuery.isPending,
    loadMore: () => activePage.loadMore(MAIL_PAGE_SIZE),
    selectedMessageId: selectedMessageId ?? inboxMessages[0]?._id,
    selectedThreadId: effectiveThreadId,
    selectedThread: threadQuery.data,
    unreadCounts: unreadCountQuery.data
      ? toUnreadCountRecord(unreadCountQuery.data)
      : {},
  };
}

function canSeedDemoMail(accounts: MailAccountDocument[] | undefined) {
  return env.VITE_NODE_ENV === "development" && accounts?.length === 0;
}

function useThreadQuery(threadId: InboxMessage["threadId"] | undefined) {
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
