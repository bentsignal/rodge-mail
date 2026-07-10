import type { ListRenderItemInfo } from "react-native";
import { useDeferredValue, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { usePaginatedQuery } from "convex/react";

import type {
  MailAccount,
  MailAccountFilter,
  MailThread,
} from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { AccountFilter } from "../components/account-filter";
import { ThreadRow } from "../components/thread-row";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import { useMailStore } from "../store";

export function MailSearchScreen() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm.trim());
  const recentThreads = useMailStore((store) => store.threads);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const accounts = useMailStore((store) => store.accounts);
  const markRead = useMailStore((store) => store.markRead);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const search = usePaginatedQuery(
    api.mail.queries.searchHeaders,
    deferredSearchTerm
      ? {
          accountId:
            accountFilter === "all"
              ? undefined
              : toConvexId<"mailAccounts">(accountFilter),
          searchTerm: deferredSearchTerm,
        }
      : "skip",
    { initialNumItems: 30 },
  );
  const results = deferredSearchTerm
    ? toMailThreads(search.results)
    : recentThreads;

  function openThread(threadId: string) {
    markRead(threadId);
    router.push({
      pathname: "/(tabs)/(search)/thread/[id]",
      params: { id: threadId },
    });
  }

  function renderThread({ item }: ListRenderItemInfo<MailThread>) {
    return <ThreadRow thread={item} onOpen={() => openThread(item.id)} />;
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Sender, subject, or message",
            onChangeText: (event) => setSearchTerm(event.nativeEvent.text),
          },
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={results}
        keyboardDismissMode="on-drag"
        keyExtractor={threadKey}
        renderItem={renderThread}
        onEndReached={() => {
          if (search.status === "CanLoadMore") search.loadMore(30);
        }}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <SearchHeader
            accountFilter={accountFilter}
            accounts={accounts}
            isShowingRecent={!searchTerm.trim()}
            onAccountChange={setAccountFilter}
          />
        }
        ListEmptyComponent={<EmptySearch searchTerm={searchTerm} />}
        ListFooterComponent={
          search.status === "LoadingMore" ? (
            <ActivityIndicator className="my-6" color="#d77a55" />
          ) : null
        }
      />
    </View>
  );
}

function SearchHeader({
  accountFilter,
  accounts,
  isShowingRecent,
  onAccountChange,
}: {
  accountFilter: MailAccountFilter;
  accounts: MailAccount[];
  isShowingRecent: boolean;
  onAccountChange: (value: MailAccountFilter) => void;
}) {
  return (
    <View className="gap-2 pt-2 pb-2">
      <AccountFilter
        accounts={accounts}
        onChange={onAccountChange}
        value={accountFilter}
      />
      <RecentMailLabel isVisible={isShowingRecent} />
    </View>
  );
}

function RecentMailLabel({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;
  return (
    <Text className="text-muted-foreground px-4 pt-1 text-sm">Recent mail</Text>
  );
}

function EmptySearch({ searchTerm }: { searchTerm: string }) {
  return (
    <View className="items-center px-8 py-24">
      <Text className="text-foreground text-lg font-bold">
        No matching mail
      </Text>
      <Text className="text-muted-foreground mt-2 text-center">
        Nothing matched “{searchTerm}”. Try a sender or a shorter subject.
      </Text>
    </View>
  );
}

function threadKey(thread: MailThread) {
  return thread.id;
}
