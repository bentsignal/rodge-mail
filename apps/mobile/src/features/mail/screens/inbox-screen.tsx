import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { usePaginatedQuery } from "convex/react";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { useColor } from "~/hooks/use-color";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { ThreadRow } from "../components/thread-row";
import { useSemanticMailSearch } from "../hooks/use-semantic-mail-search";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import { useTemporaryIos27Search } from "../mobile-search-preference";
import { useMailStore } from "../store";
import { ArchiveMailbox } from "./archive-screen";
import {
  getEmptyIsLoading,
  getFooterIsLoading,
  getVisibleInboxThreads,
} from "./inbox-list-state";
import { InboxSearchControls } from "./inbox-search-controls";
import { MailboxThreadList } from "./mailbox-thread-list";
import { useInboxMailboxControls } from "./use-inbox-mailbox-controls";
import { useInboxRefresh } from "./use-inbox-refresh";

const skippedSearch = "skip";

export function InboxScreen({ searchMode = false }: { searchMode?: boolean }) {
  const router = useRouter();
  const mailbox = useMailStore((store) => store.mailbox);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const setMailbox = useMailStore((store) => store.setMailbox);
  const [searchTerm, setSearchTerm] = useState("");
  const showTemporarySearch = useTemporaryIos27Search() && !searchMode;
  const primary = useColor("primary");

  function selectInbox(value: MailAccountFilter) {
    setMailbox("inbox");
    setAccountFilter(value);
    setSearchTerm("");
  }
  function selectArchive() {
    setMailbox("archive");
    setAccountFilter("all");
    setSearchTerm("");
  }

  return (
    <>
      <InboxSearchControls
        mailbox={mailbox}
        onSearchClose={() => router.navigate("/(tabs)/(inbox)")}
        searchMode={searchMode}
        onChange={setSearchTerm}
      />
      <ActiveMailbox
        mailbox={mailbox}
        primary={primary}
        searchTerm={searchTerm}
        showTemporarySearch={showTemporarySearch}
        onAccountChange={selectInbox}
        onArchiveSelect={selectArchive}
        onSearchChange={setSearchTerm}
      />
    </>
  );
}

function ActiveMailbox({
  mailbox,
  onAccountChange,
  onArchiveSelect,
  onSearchChange,
  primary,
  searchTerm,
  showTemporarySearch,
}: {
  mailbox: "archive" | "inbox";
  onAccountChange: (value: MailAccountFilter) => void;
  onArchiveSelect: () => void;
  onSearchChange: (value: string) => void;
  primary: string;
  searchTerm: string;
  showTemporarySearch: boolean;
}) {
  if (mailbox === "archive") {
    return (
      <ArchiveMailbox
        primary={primary}
        searchTerm={searchTerm}
        temporarySearch={
          showTemporarySearch
            ? { value: searchTerm, onChange: onSearchChange }
            : undefined
        }
        onAccountChange={onAccountChange}
      />
    );
  }
  return (
    <InboxMailbox
      searchTerm={searchTerm}
      showTemporarySearch={showTemporarySearch}
      onAccountChange={onAccountChange}
      onArchiveSelect={onArchiveSelect}
      onSearchChange={onSearchChange}
    />
  );
}

function InboxMailbox({
  onAccountChange,
  onArchiveSelect,
  onSearchChange,
  searchTerm,
  showTemporarySearch,
}: {
  onAccountChange: (value: MailAccountFilter) => void;
  onArchiveSelect: () => void;
  onSearchChange: (value: string) => void;
  searchTerm: string;
  showTemporarySearch: boolean;
}) {
  const router = useRouter();
  const threads = useMailStore((store) => store.threads);
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const markRead = useMailStore((store) => store.markRead);
  const loadMore = useMailStore((store) => store.loadMore);
  const isLoading = useMailStore((store) => store.isLoading);
  const isLoadingMore = useMailStore((store) => store.isLoadingMore);
  const debouncedSearchTerm = useDebouncedValue(searchTerm.trim(), 250);
  const primary = useColor("primary");
  const { isRefreshing, refresh, refreshError } = useInboxRefresh(accounts);
  const search = usePaginatedQuery(
    api.mail.queries.searchHeaders,
    getSearchArgs(debouncedSearchTerm, getSelectedAccountId(accountFilter)),
    { initialNumItems: 30 },
  );
  const isSearching = searchTerm.trim().length > 0;
  const semanticSearch = useSemanticMailSearch({
    accountId: getSelectedAccountId(accountFilter),
    lexicalResults: search.results,
    searchTerm: debouncedSearchTerm,
  });
  const unfilteredResults = getVisibleInboxThreads({
    inboxThreads: threads,
    isSearching,
    searchThreads: toMailThreads(semanticSearch.results),
    showUnreadOnly: false,
  });
  const controls = useInboxMailboxControls(unfilteredResults);
  const loadingFeedback = getInboxLoadingFeedback({
    debouncedSearchTerm,
    isLoading,
    isLoadingMore,
    isSearching,
    lexicalResultCount: search.results.length,
    searchIsLoading: semanticSearch.isLoading,
    searchStatus: search.status,
    searchTerm,
  });
  function openThread(threadId: string) {
    controls.retainThreadInUnreadSession(threadId);
    markRead(threadId);
    router.push({
      pathname: "/(tabs)/(inbox)/thread/[id]",
      params: { id: threadId },
    });
  }
  function renderThread({ item }: LegendListRenderItemProps<MailThread>) {
    return (
      <InboxThreadRow controls={controls} thread={item} onOpen={openThread} />
    );
  }
  function loadNextPage() {
    if (!isSearching) loadMore();
    else if (search.status === "CanLoadMore") search.loadMore(30);
  }
  return (
    <MailboxThreadList
      accountFilter={accountFilter}
      accounts={accounts}
      bulkActions={controls.bulkActions}
      data={controls.threads}
      emptyIsLoading={loadingFeedback.emptyIsLoading}
      filter={controls.filter}
      footerIsLoading={loadingFeedback.footerIsLoading}
      isRefreshing={isRefreshing}
      mailbox="inbox"
      primary={primary}
      refreshError={refreshError}
      renderThread={renderThread}
      searchTerm={isSearching ? searchTerm.trim() : undefined}
      selectedCount={controls.selectedCount}
      selectionMode={controls.selectionMode}
      temporarySearch={
        showTemporarySearch
          ? { value: searchTerm, onChange: onSearchChange }
          : undefined
      }
      onAccountChange={onAccountChange}
      onArchiveSelect={onArchiveSelect}
      onEndReached={loadNextPage}
      onFilterChange={controls.changeFilter}
      onRefresh={() => void refresh()}
      onToggleSelection={controls.toggleSelectionMode}
    />
  );
}

function InboxThreadRow({
  controls,
  onOpen,
  thread,
}: {
  controls: ReturnType<typeof useInboxMailboxControls>;
  onOpen: (threadId: string) => void;
  thread: MailThread;
}) {
  return (
    <ThreadRow
      selected={controls.selectedIds.has(thread.id)}
      selectionMode={controls.selectionMode}
      thread={thread}
      onOpen={() => onOpen(thread.id)}
      onSelect={() => controls.toggleThreadSelection(thread.id)}
    />
  );
}

function getInboxLoadingFeedback(
  input: Parameters<typeof getEmptyIsLoading>[0] & { isLoadingMore: boolean },
) {
  return {
    emptyIsLoading: getEmptyIsLoading(input),
    footerIsLoading: getFooterIsLoading({
      isLoadingMore: input.isLoadingMore,
      isSearching: input.isSearching,
      searchIsLoading: input.searchIsLoading,
      searchStatus: input.searchStatus,
    }),
  };
}

function getSelectedAccountId(accountFilter: MailAccountFilter) {
  if (accountFilter === "all") return undefined;
  return toConvexId<"mailAccounts">(accountFilter);
}

function getSearchArgs(
  searchTerm: string,
  accountId: ReturnType<typeof getSelectedAccountId>,
) {
  if (!searchTerm) return skippedSearch;
  return { accountId, searchTerm };
}
