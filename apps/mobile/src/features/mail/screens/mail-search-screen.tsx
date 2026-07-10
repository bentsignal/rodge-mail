import type { ListRenderItemInfo } from "react-native";
import { useDeferredValue, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { usePaginatedQuery } from "convex/react";

import type { MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { ThreadRow } from "../components/thread-row";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import { useSemanticMessages } from "../lib/semantic-search";
import { useMailStore } from "../store";

export function MailSearchScreen() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm.trim());
  const recentThreads = useMailStore((store) => store.threads);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const markRead = useMailStore((store) => store.markRead);
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
  const semanticMessages = useSemanticMessages({
    accountFilter,
    searchTerm: deferredSearchTerm,
  });
  const results = deferredSearchTerm
    ? toMailThreads([...search.results, ...semanticMessages])
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
          searchTerm ? null : (
            <Text className="text-muted-foreground px-4 pt-3 pb-2 text-sm">
              Recent mail
            </Text>
          )
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
