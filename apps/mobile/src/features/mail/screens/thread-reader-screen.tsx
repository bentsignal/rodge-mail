import type { LayoutChangeEvent } from "react-native";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Pin, Reply } from "lucide-react-native";

import type { MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import { getReplyAddress } from "@rodge-mail/features/mail";

import { PostalPaperBackground } from "~/features/theme/postal-surface";
import { postalDisplayFont } from "~/features/theme/postal-typography";
import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";
import { toMailThreadDetail } from "../lib/convex-mail";
import { formatMessageTime } from "../lib/mail-format";
import { ThreadMessageBody } from "./thread-message-body";

export function ThreadReaderScreen() {
  const { id, messageId } = useLocalSearchParams<{
    id: string;
    messageId?: string | string[];
  }>();
  const threadId = id ? toConvexId<"threads">(id) : undefined;
  const queryArgs = threadId ? { threadId } : "skip";
  const thread = useQuery(api.mail.queries.getThread, queryArgs);

  if (thread === undefined && threadId) return <ThreadLoading />;
  if (!thread) return <ThreadNotFound />;
  return (
    <ThreadReader
      accountAddress={thread.account.address}
      targetMessageId={firstParam(messageId)}
      thread={toMailThreadDetail(thread)}
    />
  );
}

function ThreadReader({
  accountAddress,
  targetMessageId,
  thread,
}: {
  accountAddress: string;
  targetMessageId?: string;
  thread: MailThread;
}) {
  const router = useRouter();
  const setThreadPinned = useMutation(api.mail.mutations.setThreadPinned);
  const foreground = useColor("foreground");
  const primaryForeground = useColor("primary-foreground");
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const [pinOverride, setPinOverride] = useState<boolean>();
  const isPinned = pinOverride ?? thread.isPinned;
  async function togglePin() {
    const nextIsPinned = !isPinned;
    setPinOverride(nextIsPinned);
    try {
      await setThreadPinned({
        threadId: toConvexId<"threads">(thread.id),
        isPinned: nextIsPinned,
      });
    } catch {
      setPinOverride(undefined);
    }
  }
  function reply() {
    const latestMessage = thread.messages.at(-1);
    if (!latestMessage) return;
    const address = getReplyAddress(thread.messages, accountAddress);
    if (!address) return;
    router.push({
      pathname: "/compose",
      params: {
        accountId: thread.accountId,
        replyToMessageId: latestMessage.id,
        to: address,
        subject: thread.subject.startsWith("Re:")
          ? thread.subject
          : `Re: ${thread.subject}`,
      },
    });
  }
  return (
    <>
      <Stack.Screen
        options={{
          title: thread.sender.name,
          headerRight: () => (
            <ThreadPinButton
              color={foreground}
              isPinned={isPinned}
              onPress={() => void togglePin()}
            />
          ),
        }}
      />
      <PostalPaperBackground>
        <ScrollView
          ref={scrollViewRef}
          contentContainerClassName="gap-4 px-4 pt-4 pb-40"
          contentInsetAdjustmentBehavior="automatic"
        >
          <ThreadHeader thread={thread} />
          {thread.messages.map((message) => (
            <ThreadMessageBody
              key={message.id}
              message={message}
              onLayout={
                message.id === targetMessageId
                  ? (event) => scrollToMessage(scrollViewRef.current, event)
                  : undefined
              }
            />
          ))}
        </ScrollView>
        <Pressable
          accessibilityLabel="Reply"
          accessibilityRole="button"
          className="bg-primary border-brass-soft absolute right-4 flex-row items-center gap-2 rounded-lg border px-5 py-3"
          onPress={reply}
          style={{ bottom: insets.bottom + 62 }}
        >
          <Reply color={primaryForeground} size={17} />
          <Text className="text-primary-foreground font-semibold">Reply</Text>
        </Pressable>
      </PostalPaperBackground>
    </>
  );
}

function ThreadPinButton({
  color,
  isPinned,
  onPress,
}: {
  color: string;
  isPinned: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={isPinned ? "Unpin thread" : "Pin thread"}
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
    >
      <Pin color={color} fill={isPinned ? color : "transparent"} size={19} />
    </Pressable>
  );
}

function ThreadHeader({ thread }: { thread: MailThread }) {
  return (
    <View className="gap-5 px-1 pt-2 pb-3">
      <Text
        className="text-foreground text-[30px] leading-[38px]"
        style={{ fontFamily: postalDisplayFont }}
      >
        {thread.subject}
      </Text>
      <View className="flex-row items-center gap-3">
        <View className="bg-paper-deep border-paper-border size-11 items-center justify-center rounded-lg border">
          <Text className="text-foreground text-base font-bold">
            {thread.sender.name.slice(0, 1)}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-foreground text-base font-semibold">
            {thread.sender.name}
          </Text>
          <Text className="text-muted-foreground text-sm" numberOfLines={1}>
            {thread.sender.address}
          </Text>
        </View>
        <Text className="text-muted-foreground text-xs">
          {formatMessageTime(thread.receivedAt)}
        </Text>
      </View>
    </View>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function scrollToMessage(
  scrollView: ScrollView | null,
  event: LayoutChangeEvent,
) {
  const y = Math.max(0, event.nativeEvent.layout.y - 16);
  requestAnimationFrame(() => scrollView?.scrollTo({ animated: false, y }));
}

function ThreadNotFound() {
  return (
    <View className="bg-background flex-1 items-center justify-center px-8">
      <Text className="text-foreground text-lg font-bold">
        Message unavailable
      </Text>
      <Text className="text-muted-foreground mt-2 text-center">
        This thread is no longer in the local mailbox.
      </Text>
    </View>
  );
}

function ThreadLoading() {
  return (
    <View className="bg-background flex-1 items-center justify-center">
      <Text className="text-muted-foreground">Loading message…</Text>
    </View>
  );
}
