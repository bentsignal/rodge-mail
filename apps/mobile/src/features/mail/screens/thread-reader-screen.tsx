import type { LayoutChangeEvent } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Archive, Pin, Reply } from "lucide-react-native";

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
  const setThreadRead = useMutation(api.mail.mutations.setThreadRead);

  // eslint-disable-next-line no-restricted-syntax -- Direct and notification routes bypass the inbox tap that normally marks a thread read.
  useEffect(() => {
    if (!threadId || !thread || thread.unreadCount === 0) return;
    void setThreadRead({ threadId, isRead: true }).catch(() => undefined);
  }, [setThreadRead, thread, threadId]);

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
  const archiveThread = useMutation(api.mail.mutations.archiveThread);
  const setThreadPinned = useMutation(api.mail.mutations.setThreadPinned);
  const foreground = useColor("foreground");
  const scrollViewRef = useRef<ScrollView>(null);
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
  async function archive() {
    try {
      await archiveThread({ threadId: toConvexId<"threads">(thread.id) });
      router.back();
    } catch {
      Alert.alert("Couldn’t archive this thread", "Please try again.");
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
            <ThreadReplyAction color={foreground} onReply={reply} />
          ),
        }}
      />
      <PostalPaperBackground>
        <ScrollView
          ref={scrollViewRef}
          contentContainerClassName="gap-4 px-4 pt-4 pb-24"
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
          <ThreadFooterActions
            isPinned={isPinned}
            onArchive={() => void archive()}
            onPin={() => void togglePin()}
          />
        </ScrollView>
      </PostalPaperBackground>
    </>
  );
}

function ThreadReplyAction({
  color,
  onReply,
}: {
  color: string;
  onReply: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Starts a reply to the latest message"
      accessibilityLabel="Reply"
      accessibilityRole="button"
      hitSlop={10}
      onPress={onReply}
    >
      <Reply color={color} size={20} />
    </Pressable>
  );
}

function ThreadFooterActions({
  isPinned,
  onArchive,
  onPin,
}: {
  isPinned: boolean;
  onArchive: () => void;
  onPin: () => void;
}) {
  const foreground = useColor("foreground");
  return (
    <View className="mt-1 flex-row gap-2">
      <ThreadFooterButton
        icon={
          <Pin
            color={foreground}
            fill={isPinned ? foreground : "transparent"}
            size={18}
          />
        }
        label={isPinned ? "Unpin" : "Pin"}
        onPress={onPin}
      />
      <ThreadFooterButton
        icon={<Archive color={foreground} size={18} />}
        label="Archive"
        onPress={onArchive}
      />
    </View>
  );
}

function ThreadFooterButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} thread`}
      accessibilityRole="button"
      className="border-paper-border bg-paper flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 active:opacity-70"
      onPress={onPress}
    >
      {icon}
      <Text className="text-foreground text-sm font-semibold">{label}</Text>
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
