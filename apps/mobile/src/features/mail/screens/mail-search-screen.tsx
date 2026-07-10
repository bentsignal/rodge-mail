import type { ListRenderItemInfo } from "react-native";
import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import type { MailThread } from "@rodge-mail/features/mail";

import { ThreadRow } from "../components/thread-row";
import { filterAndSortThreads, threadMatchesSearch } from "../lib/mail-format";
import { useMailStore } from "../store";

export function MailSearchScreen() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const threads = useMailStore((store) => store.threads);
  const markRead = useMailStore((store) => store.markRead);
  const results = filterAndSortThreads(
    threads.filter((thread) => threadMatchesSearch(thread, searchTerm)),
    "all",
  );

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
        ListHeaderComponent={
          searchTerm ? null : (
            <Text className="text-muted-foreground px-4 pt-3 pb-2 text-sm">
              Recent mail
            </Text>
          )
        }
        ListEmptyComponent={<EmptySearch searchTerm={searchTerm} />}
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
