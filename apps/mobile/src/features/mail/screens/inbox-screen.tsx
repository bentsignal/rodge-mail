import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useState } from "react";
import { Animated, RefreshControl, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { LegendList } from "@legendapp/list/react-native";
import { usePaginatedQuery } from "convex/react";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import type { MobileMailAccount } from "../lib/convex-mail";
import { useColor } from "~/hooks/use-color";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { ThreadRow } from "../components/thread-row";
import { useSemanticMailSearch } from "../hooks/use-semantic-mail-search";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import { useMailStore } from "../store";
import { InboxHeader } from "./inbox-header";
import { EmptyInbox, InboxFooter } from "./inbox-list-feedback";
import {
  getEmptyIsLoading,
  getFooterIsLoading,
  getInboxListFeedback,
  getVisibleInboxThreads,
} from "./inbox-list-state";
import { useInboxFilterTransition } from "./use-inbox-filter-transition";
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
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
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
  const results = getVisibleInboxThreads({
    inboxThreads: threads,
    isSearching,
    searchThreads: toMailThreads(semanticSearch.results),
    showUnreadOnly,
  });
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
    return <ThreadRow thread={item} onOpen={() => openThread(item.id)} />;
  }
  function loadNextPage() {
    if (!isSearching) loadMore();
    else if (search.status === "CanLoadMore") search.loadMore(30);
  }
  return (
    <>
      <InboxSearchScreen
        colors={colors}
        searchMode={searchMode}
        onSearchChange={setSearchTerm}
      />
      <InboxThreadList
        accountFilter={accountFilter}
        accounts={accounts}
        data={results}
        emptyIsLoading={emptyIsLoading}
        footerIsLoading={footerIsLoading}
        isRefreshing={isRefreshing}
        primary={colors.primary}
        refreshError={refreshError}
        renderThread={renderThread}
        searchTerm={isSearching ? searchTerm.trim() : undefined}
        showUnreadOnly={showUnreadOnly}
        onAccountChange={setAccountFilter}
        onEndReached={loadNextPage}
        onRefresh={() => void refresh()}
        onUnreadChange={setShowUnreadOnly}
      />
    </>
  );
}

function InboxSearchScreen({
  colors,
  onSearchChange,
  searchMode,
}: {
  colors: ReturnType<typeof useInboxColors>;
  onSearchChange: (value: string) => void;
  searchMode: boolean;
}) {
  if (!searchMode) return <Stack.Screen options={{ headerShown: false }} />;
  return (
    <>
      <Stack.Title>Search</Stack.Title>
      <Stack.SearchBar
        barTintColor={colors.paper}
        hideWhenScrolling={false}
        onCancelButtonPress={() => onSearchChange("")}
        onChangeText={(event) => onSearchChange(event.nativeEvent.text)}
        placeholder="Search mail"
        placement="automatic"
        textColor={colors.foreground}
        tintColor={colors.primary}
      />
    </>
  );
}

function useInboxColors() {
  return {
    foreground: useColor("foreground"),
    paper: useColor("paper"),
    primary: useColor("primary"),
  };
}

function InboxThreadList({
  accountFilter,
  accounts,
  data,
  emptyIsLoading,
  footerIsLoading,
  isRefreshing,
  onAccountChange,
  onEndReached,
  onRefresh,
  primary,
  refreshError,
  renderThread,
  searchTerm,
  showUnreadOnly,
  onUnreadChange,
}: {
  accountFilter: MailAccountFilter;
  accounts: MobileMailAccount[];
  data: MailThread[];
  emptyIsLoading: boolean;
  footerIsLoading: boolean;
  isRefreshing: boolean;
  onAccountChange: (value: MailAccountFilter) => void;
  onEndReached: () => void;
  onRefresh: () => void;
  primary: string;
  refreshError: string | undefined;
  renderThread: (
    info: LegendListRenderItemProps<MailThread>,
  ) => React.ReactElement;
  searchTerm: string | undefined;
  showUnreadOnly: boolean;
  onUnreadChange: (value: boolean) => void;
}) {
  const paper = useColor("paper");
  const transition = useInboxFilterTransition(data, showUnreadOnly);
  const feedback = getInboxListFeedback({
    emptyIsLoading,
    footerIsLoading,
    resultCount: transition.data.length,
  });
  return (
    <View className="bg-paper flex-1">
      <InboxHeader
        accountFilter={accountFilter}
        accounts={accounts}
        onAccountChange={onAccountChange}
        refreshError={refreshError}
        showUnreadOnly={showUnreadOnly}
        onUnreadChange={onUnreadChange}
      />
      <Animated.View style={{ flex: 1, opacity: transition.opacity }}>
        <LegendList
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 12 }}
          data={transition.data}
          estimatedItemSize={109}
          keyExtractor={threadKey}
          maintainVisibleContentPosition={true}
          recycleItems={true}
          renderItem={renderThread}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          style={{ backgroundColor: paper, flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              tintColor={primary}
              onRefresh={onRefresh}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={
            <EmptyInbox
              isLoading={feedback.emptyIsLoading}
              primary={primary}
              searchTerm={searchTerm}
              showUnreadOnly={transition.showUnreadOnly}
            />
          }
          ListFooterComponent={
            <InboxFooter
              isLoading={feedback.footerIsLoading}
              primary={primary}
            />
          }
        />
      </Animated.View>
    </View>
  );
}

function threadKey(thread: MailThread) {
  return thread.id;
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
