import type { ListRenderItemInfo } from "react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { usePaginatedQuery } from "convex/react";
import { Mail } from "lucide-react-native";

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
import { EmptyInbox, InboxFooter } from "./inbox-list-feedback";
import {
  getEmptyIsLoading,
  getFooterIsLoading,
  getVisibleInboxThreads,
} from "./inbox-list-state";
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
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const debouncedSearchTerm = useDebouncedValue(searchTerm.trim(), 250);
  const { card, foreground, primary } = useInboxColors();
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
            barTintColor: card,
            hideWhenScrolling: false,
            headerIconColor: foreground,
            onCancelButtonPress: () => setSearchTerm(""),
            onChangeText: (event) => setSearchTerm(event.nativeEvent.text),
            placeholder: "Search mail",
            placement: "stacked",
            textColor: foreground,
            tintColor: foreground,
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
        showUnreadOnly={showUnreadOnly}
        onAccountChange={setAccountFilter}
        onEndReached={loadNextPage}
        onRefresh={() => void refresh()}
        onToggleUnread={() => setShowUnreadOnly((current) => !current)}
      />
    </View>
  );
}

function useInboxColors() {
  return {
    card: useColor("card"),
    foreground: useColor("foreground"),
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
  onToggleUnread,
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
  showUnreadOnly: boolean;
  onToggleUnread: () => void;
}) {
  return (
    <FlatList
      data={data}
      keyExtractor={threadKey}
      renderItem={renderThread}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      contentContainerClassName="pb-24"
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
          onToggleUnread={onToggleUnread}
        />
      }
      ListEmptyComponent={
        <EmptyInbox
          isLoading={emptyIsLoading}
          primary={primary}
          searchTerm={searchTerm}
          showUnreadOnly={showUnreadOnly}
        />
      }
      ListFooterComponent={
        <InboxFooter isLoading={footerIsLoading} primary={primary} />
      }
    />
  );
}

function InboxHeader({
  accountFilter,
  accounts,
  onAccountChange,
  refreshError,
  showUnreadOnly,
  onToggleUnread,
}: {
  accountFilter: MailAccountFilter;
  accounts: MobileMailAccount[];
  onAccountChange: (value: MailAccountFilter) => void;
  refreshError: string | undefined;
  showUnreadOnly: boolean;
  onToggleUnread: () => void;
}) {
  const foreground = useColor("foreground");
  const primaryForeground = useColor("primary-foreground");

  return (
    <View className="gap-3 pt-4 pb-3">
      <View className="flex-row items-center justify-between px-4">
        <Text className="text-foreground text-3xl font-bold">Inbox</Text>
        <Pressable
          accessibilityLabel={
            showUnreadOnly ? "Show all messages" : "Show unread messages only"
          }
          accessibilityRole="button"
          accessibilityState={{ selected: showUnreadOnly }}
          className={
            showUnreadOnly
              ? "bg-primary border-brass-soft flex-row items-center gap-2 rounded-full border px-3 py-2"
              : "bg-paper border-well-border flex-row items-center gap-2 rounded-full border px-3 py-2"
          }
          onPress={onToggleUnread}
        >
          <Mail
            color={showUnreadOnly ? primaryForeground : foreground}
            size={16}
          />
          <Text
            className={
              showUnreadOnly
                ? "text-primary-foreground text-sm font-semibold"
                : "text-foreground text-sm font-semibold"
            }
          >
            Unread
          </Text>
        </Pressable>
      </View>
      <AccountFilter
        accounts={accounts}
        value={accountFilter}
        onChange={onAccountChange}
      />
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
