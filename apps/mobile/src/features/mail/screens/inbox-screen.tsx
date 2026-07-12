import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useState } from "react";
import { Animated, RefreshControl, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Host, Switch } from "@expo/ui";
import { LegendList } from "@legendapp/list/react-native";
import { usePaginatedQuery } from "convex/react";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import type { MobileMailAccount } from "../lib/convex-mail";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { AccountFilter } from "../components/account-filter";
import { ThreadRow } from "../components/thread-row";
import { useSemanticMailSearch } from "../hooks/use-semantic-mail-search";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import { useMailStore } from "../store";
import { EmptyInbox, InboxFooter } from "./inbox-list-feedback";
import {
  getEmptyIsLoading,
  getFooterIsLoading,
  getInboxListFeedback,
  getVisibleInboxThreads,
} from "./inbox-list-state";
import { InboxSyncStatus } from "./inbox-sync-status";
import { useInboxFilterTransition } from "./use-inbox-filter-transition";
import { useInboxRefresh } from "./use-inbox-refresh";

const skippedSearch = "skip";

export function InboxScreen() {
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
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerSearchBarOptions: {
            barTintColor: colors.paper,
            hideWhenScrolling: false,
            headerIconColor: colors.foreground,
            onCancelButtonPress: () => setSearchTerm(""),
            onChangeText: (event) => setSearchTerm(event.nativeEvent.text),
            placeholder: "Search mail",
            placement: "inline",
            textColor: colors.foreground,
            tintColor: colors.primary,
          },
          headerTitle: "",
        }}
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
    <Animated.View style={{ flex: 1, opacity: transition.opacity }}>
      <LegendList
        contentContainerStyle={{ paddingBottom: 24 }}
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
        ListHeaderComponent={
          <InboxHeader
            accountFilter={accountFilter}
            accounts={accounts}
            onAccountChange={onAccountChange}
            refreshError={refreshError}
            showUnreadOnly={showUnreadOnly}
            onUnreadChange={onUnreadChange}
          />
        }
        ListEmptyComponent={
          <EmptyInbox
            isLoading={feedback.emptyIsLoading}
            primary={primary}
            searchTerm={searchTerm}
            showUnreadOnly={transition.showUnreadOnly}
          />
        }
        ListFooterComponent={
          <InboxFooter isLoading={feedback.footerIsLoading} primary={primary} />
        }
      />
    </Animated.View>
  );
}

function InboxHeader({
  accountFilter,
  accounts,
  onAccountChange,
  refreshError,
  showUnreadOnly,
  onUnreadChange,
}: {
  accountFilter: MailAccountFilter;
  accounts: MobileMailAccount[];
  onAccountChange: (value: MailAccountFilter) => void;
  refreshError: string | undefined;
  showUnreadOnly: boolean;
  onUnreadChange: (value: boolean) => void;
}) {
  const colorScheme = useResolvedMobileColorScheme();
  const primary = useColor("primary");

  return (
    <View className="bg-paper border-paper-border border-b px-3 py-2">
      <View className="min-h-11 flex-row items-center gap-3">
        <AccountFilter
          accounts={accounts}
          value={accountFilter}
          onChange={onAccountChange}
        />
        <Host
          colorScheme={colorScheme}
          matchContents={{ vertical: true }}
          seedColor={primary}
          style={{ width: 132 }}
        >
          <Switch
            label="Unread"
            testID="unread-only-switch"
            value={showUnreadOnly}
            onValueChange={onUnreadChange}
          />
        </Host>
      </View>
      <InboxSyncStatus accounts={accounts} error={refreshError} />
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
