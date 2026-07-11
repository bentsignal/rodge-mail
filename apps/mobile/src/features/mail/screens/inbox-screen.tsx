import type { ListRenderItemInfo } from "react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { usePaginatedQuery } from "convex/react";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import type { MobileMailAccount } from "../lib/convex-mail";
import { useColor } from "~/hooks/use-color";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { AccountFilter } from "../components/account-filter";
import { ThreadRow } from "../components/thread-row";
import { useSemanticMailSearch } from "../hooks/use-semantic-mail-search";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import { useMailStore } from "../store";
import { getEmptyIsLoading, getFooterIsLoading } from "./inbox-list-state";
import { InboxSyncStatus } from "./inbox-sync-status";
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
  const debouncedSearchTerm = useDebouncedValue(searchTerm.trim(), 250);
  const backgroundColor = useColor("background");
  const foreground = useColor("foreground");
  const primary = useColor("primary");
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
  const results = isSearching ? toMailThreads(semanticSearch.results) : threads;
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

  function renderThread({ item }: ListRenderItemInfo<MailThread>) {
    return <ThreadRow thread={item} onOpen={() => openThread(item.id)} />;
  }

  function loadNextPage() {
    if (!isSearching) loadMore();
    else if (search.status === "CanLoadMore") search.loadMore(30);
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            barTintColor: backgroundColor,
            hideWhenScrolling: false,
            headerIconColor: foreground,
            onCancelButtonPress: () => setSearchTerm(""),
            onChangeText: (event) => setSearchTerm(event.nativeEvent.text),
            placeholder: "Sender, subject, or message",
            placement: "stacked",
            textColor: foreground,
            tintColor: primary,
          },
        }}
      />
      <InboxThreadList
        accountFilter={accountFilter}
        accounts={accounts}
        data={results}
        emptyIsLoading={emptyIsLoading}
        footerIsLoading={footerIsLoading}
        isRefreshing={isRefreshing}
        primary={primary}
        refreshError={refreshError}
        renderThread={renderThread}
        searchTerm={isSearching ? searchTerm.trim() : undefined}
        onAccountChange={setAccountFilter}
        onEndReached={loadNextPage}
        onRefresh={() => void refresh()}
      />
    </View>
  );
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
  renderThread: (info: ListRenderItemInfo<MailThread>) => React.ReactElement;
  searchTerm: string | undefined;
}) {
  return (
    <FlatList
      data={data}
      keyExtractor={threadKey}
      renderItem={renderThread}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
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
        />
      }
      ListEmptyComponent={
        <EmptyInbox isLoading={emptyIsLoading} searchTerm={searchTerm} />
      }
      ListFooterComponent={<InboxFooter isLoading={footerIsLoading} />}
    />
  );
}

function InboxHeader({
  accountFilter,
  accounts,
  onAccountChange,
  refreshError,
}: {
  accountFilter: MailAccountFilter;
  accounts: MobileMailAccount[];
  onAccountChange: (value: MailAccountFilter) => void;
  refreshError: string | undefined;
}) {
  return (
    <View className="gap-2 pt-2 pb-3">
      <AccountFilter
        accounts={accounts}
        value={accountFilter}
        onChange={onAccountChange}
      />
      <InboxSyncStatus accounts={accounts} error={refreshError} />
    </View>
  );
}

function EmptyInbox({
  isLoading,
  searchTerm,
}: {
  isLoading: boolean;
  searchTerm?: string;
}) {
  if (isLoading) {
    return (
      <View className="items-center py-24">
        <ActivityIndicator color="#d77a55" size="large" />
      </View>
    );
  }
  if (searchTerm) {
    return (
      <View className="items-center px-8 py-24">
        <Text className="text-foreground text-lg font-bold">
          No matching mail
        </Text>
        <Text className="text-muted-foreground mt-2 text-center leading-5">
          Nothing matched “{searchTerm}”. Try a sender or a shorter subject.
        </Text>
      </View>
    );
  }
  return (
    <View className="items-center px-8 py-24">
      <Text className="text-foreground text-lg font-bold">
        You are caught up
      </Text>
      <Text className="text-muted-foreground mt-2 text-center leading-5">
        New mail will appear here in the order it arrives.
      </Text>
    </View>
  );
}

function InboxFooter({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;
  return (
    <View className="items-center py-6">
      <ActivityIndicator color="#d77a55" />
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
