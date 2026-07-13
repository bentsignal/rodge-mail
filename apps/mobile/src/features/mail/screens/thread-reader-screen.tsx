import type { LayoutChangeEvent } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Code2, Reply, Sparkles } from "lucide-react-native";

import type { MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import { getReplyAddress } from "@rodge-mail/features/mail";

import type { MobileMailbox } from "../store";
import type { MessageViewMode } from "./thread-message-body";
import { PostalPaperBackground } from "~/features/theme/postal-surface";
import { postalDisplayFont } from "~/features/theme/postal-typography";
import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";
import { toMailThreadDetail } from "../lib/convex-mail";
import { formatMessageTime } from "../lib/mail-format";
import { parseMobileMailbox } from "./mailbox-controls";
import { ThreadMessageBody } from "./thread-message-body";
import { ThreadReaderFooter } from "./thread-reader-footer";
import { useThreadReaderActions } from "./use-thread-reader-actions";

export function ThreadReaderScreen() {
  const {
    id,
    mailbox: mailboxParam,
    messageId,
  } = useLocalSearchParams<{
    id: string;
    mailbox?: string | string[];
    messageId?: string | string[];
  }>();
  const mailbox = parseMobileMailbox(firstParam(mailboxParam));
  const threadId = id ? toConvexId<"threads">(id) : undefined;
  const queryArgs = threadId ? { threadId } : "skip";
  const thread = useQuery(api.mail.queries.getThread, queryArgs);
  const setThreadRead = useMutation(api.mail.mutations.setThreadRead);
  const requestCleanView = useMutation(
    api.classification.mutations.requestCleanView,
  );

  // eslint-disable-next-line no-restricted-syntax -- Direct and notification routes bypass the inbox tap that normally marks a thread read.
  useEffect(() => {
    if (!threadId || !thread || thread.unreadCount === 0) return;
    void setThreadRead({ threadId, isRead: true }).catch(() => undefined);
  }, [setThreadRead, thread, threadId]);

  // eslint-disable-next-line no-restricted-syntax -- Opening a thread requests any missing server-generated clean views.
  useEffect(() => {
    if (!thread) return;
    for (const message of thread.messages) {
      if (message.classification?.cleanedMarkdown !== undefined) continue;
      void requestCleanView({ messageId: message._id }).catch(() => undefined);
    }
  }, [requestCleanView, thread]);

  if (thread === undefined && threadId) return <ThreadLoading />;
  if (!thread) return <ThreadNotFound />;
  return (
    <ThreadReader
      accountAddress={thread.account.address}
      mailbox={mailbox}
      targetMessageId={firstParam(messageId)}
      thread={toMailThreadDetail(thread)}
    />
  );
}

function ThreadReader({
  accountAddress,
  mailbox,
  targetMessageId,
  thread,
}: {
  accountAddress: string;
  mailbox: MobileMailbox;
  targetMessageId?: string;
  thread: MailThread;
}) {
  const router = useRouter();
  const foreground = useColor("foreground");
  const scrollViewRef = useRef<ScrollView>(null);
  const [viewMode, setViewMode] = useState<MessageViewMode>("clean");
  const actions = useThreadReaderActions(thread);
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
          <MessageViewSwitch onChange={setViewMode} value={viewMode} />
          {thread.messages.map((message) => (
            <ThreadMessageBody
              key={message.id}
              message={message}
              viewMode={viewMode}
              onLayout={
                message.id === targetMessageId
                  ? (event) => scrollToMessage(scrollViewRef.current, event)
                  : undefined
              }
            />
          ))}
          <ThreadReaderFooter
            isPinned={actions.isPinned}
            mailbox={mailbox}
            onArchive={() => void actions.archive()}
            onDelete={actions.confirmPermanentDelete}
            onPin={() => void actions.togglePin()}
            onRestore={() => void actions.restore()}
          />
        </ScrollView>
      </PostalPaperBackground>
    </>
  );
}

function MessageViewSwitch({
  onChange,
  value,
}: {
  onChange: (value: MessageViewMode) => void;
  value: MessageViewMode;
}) {
  const foreground = useColor("foreground");
  const muted = useColor("muted-foreground");
  return (
    <View
      accessibilityLabel="Message view"
      className="bg-well border-well-border mx-1 flex-row self-start rounded-xl border p-1"
    >
      <MessageViewButton
        color={value === "clean" ? foreground : muted}
        icon={Sparkles}
        label="Clean"
        onPress={() => onChange("clean")}
        selected={value === "clean"}
      />
      <MessageViewButton
        color={value === "original" ? foreground : muted}
        icon={Code2}
        label="Original"
        onPress={() => onChange("original")}
        selected={value === "original"}
      />
    </View>
  );
}

function MessageViewButton({
  color,
  icon: Icon,
  label,
  onPress,
  selected,
}: {
  color: string;
  icon: typeof Sparkles;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={
        selected
          ? "bg-paper flex-row items-center gap-1.5 rounded-lg px-3 py-2"
          : "flex-row items-center gap-1.5 rounded-lg px-3 py-2"
      }
      onPress={onPress}
    >
      <Icon color={color} size={14} />
      <Text className="text-foreground text-xs font-semibold">{label}</Text>
    </Pressable>
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
