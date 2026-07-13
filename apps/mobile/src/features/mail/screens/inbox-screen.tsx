import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { usePaginatedQuery } from "convex/react";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { useColor } from "~/hooks/use-color";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { ThreadRow } from "../components/thread-row";
import { useSemanticMailSearch } from "../hooks/use-semantic-mail-search";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import {
  focusNativeSearch,
  nativeSearchBarRef,
} from "../native-search-controller";
import { useMailStore } from "../store";
import {
  getEmptyIsLoading,
  getFooterIsLoading,
  getVisibleInboxThreads,
} from "./inbox-list-state";
import { MailboxThreadList } from "./mailbox-thread-list";
import { useInboxMailboxControls } from "./use-inbox-mailbox-controls";
import { useInboxRefresh } from "./use-inbox-refresh";

const skippedSearch = "skip";

export function InboxScreen({ searchMode = false }: { searchMode?: boolean }) {
  const router = useRouter();
  const threads = useMailStore((store) => store.threads);
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const markRead = useMailStore((store) => store.markRead);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const loadMore = useMailStore((store) => store.loadMore);
  const isLoading = useMailStore((store) => store.isLoading);
  const isLoadingMore = useMailStore((store) => store.isLoadingMore);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm.trim(), 250);
  const colors = useInboxColors();
  const { isRefreshing, refresh, refreshError } = useInboxRefresh(accounts);
  const selectedAccountId = getSelectedAccountId(accountFilter);
  const search = usePaginatedQuery(
    api.mail.queries.searchHeaders,
    getSearchArgs(debouncedSearchTerm, selectedAccountId),
    { initialNumItems: 30 },
  );
  const isSearching = searchTerm.trim().length > 0;
  const semanticSearch = useSemanticMailSearch({
    accountId: selectedAccountId,
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
  const emptyIsLoading = getEmptyIsLoading({
    debouncedSearchTerm,
    isLoading,
    isSearching,
    lexicalResultCount: search.results.length,
    searchIsLoading: semanticSearch.isLoading,
    searchStatus: search.status,
    searchTerm,
  });
  const footerIsLoading = getFooterIsLoading({
    isLoadingMore,
    isSearching,
    searchIsLoading: semanticSearch.isLoading,
    searchStatus: search.status,
  });
  function openThread(threadId: string) {
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
    <>
      <InboxSearchScreen
        colors={colors}
        onSearchClose={() => router.navigate("/(tabs)/(inbox)")}
        searchMode={searchMode}
        onSearchChange={setSearchTerm}
      />
      <MailboxThreadList
        accountFilter={accountFilter}
        accounts={accounts}
        bulkActions={controls.bulkActions}
        data={controls.threads}
        emptyIsLoading={emptyIsLoading}
        filter={controls.filter}
        footerIsLoading={footerIsLoading}
        isRefreshing={isRefreshing}
        mailbox="inbox"
        primary={colors.primary}
        refreshError={refreshError}
        renderThread={renderThread}
        searchTerm={isSearching ? searchTerm.trim() : undefined}
        selectedCount={controls.selectedCount}
        selectionMode={controls.selectionMode}
        onAccountChange={setAccountFilter}
        onEndReached={loadNextPage}
        onFilterChange={controls.changeFilter}
        onRefresh={() => void refresh()}
        onToggleSelection={controls.toggleSelectionMode}
      />
    </>
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

function InboxSearchScreen({
  colors,
  onSearchChange,
  onSearchClose,
  searchMode,
}: {
  colors: ReturnType<typeof useInboxColors>;
  onSearchChange: (value: string) => void;
  onSearchClose: () => void;
  searchMode: boolean;
}) {
  if (!searchMode) return <Stack.Screen options={{ headerShown: false }} />;
  return (
    <FocusedSearchBar
      colors={colors}
      onSearchChange={onSearchChange}
      onSearchClose={onSearchClose}
    />
  );
}

function FocusedSearchBar({
  colors,
  onSearchChange,
  onSearchClose,
}: {
  colors: ReturnType<typeof useInboxColors>;
  onSearchChange: (value: string) => void;
  onSearchClose: () => void;
}) {
  return (
    <Stack.SearchBar
      ref={nativeSearchBarRef}
      autoFocus
      barTintColor={colors.paper}
      hideNavigationBar={true}
      hideWhenScrolling={false}
      onCancelButtonPress={() => {
        onSearchChange("");
        onSearchClose();
      }}
      onChangeText={(event) => onSearchChange(event.nativeEvent.text)}
      onOpen={focusNativeSearch}
      placeholder="Search mail"
      placement="automatic"
      textColor={colors.foreground}
      tintColor={colors.primary}
    />
  );
}

function useInboxColors() {
  return {
    foreground: useColor("foreground"),
    paper: useColor("paper"),
    primary: useColor("primary"),
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
