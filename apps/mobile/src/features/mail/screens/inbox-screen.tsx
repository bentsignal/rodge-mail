import type { ListRenderItemInfo } from "react-native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SquarePen } from "lucide-react-native";

import type {
  InboxCategory,
  MailAccount,
  MailAccountFilter,
  MailThread,
} from "@rodge-mail/features/mail";

import { useColor } from "~/hooks/use-color";
import { AccountFilter } from "../components/account-filter";
import { CategoryControl } from "../components/category-control";
import { ThreadRow } from "../components/thread-row";
import { useMailStore } from "../store";

export function InboxScreen() {
  const router = useRouter();
  const threads = useMailStore((store) => store.threads);
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const category = useMailStore((store) => store.category);
  const markRead = useMailStore((store) => store.markRead);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const setCategory = useMailStore((store) => store.setCategory);
  const loadMore = useMailStore((store) => store.loadMore);
  const isLoading = useMailStore((store) => store.isLoading);
  const isLoadingMore = useMailStore((store) => store.isLoadingMore);
  const background = useColor("background");

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

  return (
    <View className="bg-background flex-1">
      <FlatList
        data={threads}
        keyExtractor={threadKey}
        renderItem={renderThread}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <InboxHeader
            accountFilter={accountFilter}
            accounts={accounts}
            category={category}
            onAccountChange={setAccountFilter}
            onCategoryChange={setCategory}
          />
        }
        ListEmptyComponent={
          <EmptyInbox category={category} isLoading={isLoading} />
        }
        ListFooterComponent={<InboxFooter isLoading={isLoadingMore} />}
      />
      <Pressable
        accessibilityLabel="Compose email"
        accessibilityRole="button"
        className="bg-primary absolute right-5 bottom-5 size-14 items-center justify-center rounded-full shadow-lg"
        onPress={() => router.push("/compose")}
      >
        <SquarePen color={background} />
      </Pressable>
    </View>
  );
}

function InboxHeader({
  accountFilter,
  accounts,
  category,
  onAccountChange,
  onCategoryChange,
}: {
  accountFilter: MailAccountFilter;
  accounts: MailAccount[];
  category: InboxCategory;
  onAccountChange: (value: MailAccountFilter) => void;
  onCategoryChange: (value: InboxCategory) => void;
}) {
  return (
    <View className="gap-4 pt-2 pb-3">
      <AccountFilter
        accounts={accounts}
        value={accountFilter}
        onChange={onAccountChange}
      />
      <View className="px-4">
        <CategoryControl value={category} onChange={onCategoryChange} />
      </View>
    </View>
  );
}

function EmptyInbox({
  category,
  isLoading,
}: {
  category: "focused" | "other";
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <View className="items-center py-24">
        <ActivityIndicator color="#d77a55" size="large" />
      </View>
    );
  }
  if (category === "focused") {
    return (
      <View className="items-center px-8 py-24">
        <Text className="text-foreground text-lg font-bold">
          You are caught up
        </Text>
        <Text className="text-muted-foreground mt-2 text-center leading-5">
          Mail that needs your attention will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center px-8 py-24">
      <Text className="text-foreground text-lg font-bold">
        Nothing else here
      </Text>
      <Text className="text-muted-foreground mt-2 text-center leading-5">
        Newsletters and low-priority updates will wait here.
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
