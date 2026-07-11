import type { LayoutChangeEvent } from "react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useAction, useMutation, useQuery } from "convex/react";
import { Download, Paperclip, Pin, Reply } from "lucide-react-native";

import type { MailMessage, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import { normalizeAttachmentFileName } from "@rodge-mail/convex/attachments/constants";
import { getReplyAddress } from "@rodge-mail/features/mail";

import { PostalSurface } from "~/features/theme/postal-surface";
import { useColor } from "~/hooks/use-color";
import { MobileEmailBody } from "../components/mobile-email-body";
import { toConvexId } from "../lib/convex-id";
import { toMailThreadDetail } from "../lib/convex-mail";
import { formatMessageTime } from "../lib/mail-format";

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
      <View className="bg-background flex-1">
        <ScrollView
          ref={scrollViewRef}
          contentContainerClassName="gap-4 px-4 pt-4 pb-40"
          contentInsetAdjustmentBehavior="automatic"
        >
          <ThreadHeader thread={thread} />
          {thread.messages.map((message) => (
            <MessageBody
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
          className="bg-primary border-brass-soft absolute right-5 bottom-5 flex-row items-center gap-2 rounded-full border px-5 py-3"
          onPress={reply}
          style={{ bottom: insets.bottom + 62 }}
        >
          <Reply color={primaryForeground} size={17} />
          <Text className="text-primary-foreground font-semibold">Reply</Text>
        </Pressable>
      </View>
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
    <View className="gap-4 px-1 pb-2">
      <Text className="text-foreground text-3xl leading-9 font-bold">
        {thread.subject}
      </Text>
      <View className="flex-row items-center gap-3">
        <View className="bg-brass-soft border-brass size-11 items-center justify-center rounded-full border">
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

function MessageBody({
  message,
  onLayout,
}: {
  message: MailMessage;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const downloadAttachment = useAction(api.attachments.actions.download);
  const mutedForeground = useColor("muted-foreground");
  const [downloadingId, setDownloadingId] = useState<string>();

  async function download(attachment: MailMessage["attachments"][number]) {
    if (downloadingId) return;
    setDownloadingId(attachment.id);
    try {
      const { url } = await downloadAttachment({
        attachmentId: toConvexId<"attachments">(attachment.id),
      });
      const fileName =
        normalizeAttachmentFileName(attachment.name) || "attachment";
      const file = await File.downloadFileAsync(
        url,
        new File(Paths.cache, fileName),
        { idempotent: true },
      );
      await Sharing.shareAsync(file.uri, {
        dialogTitle: `Open ${fileName}`,
        mimeType: attachment.contentType,
      });
    } catch (error) {
      Alert.alert("Couldn’t download attachment", getDownloadError(error));
    }
    setDownloadingId(undefined);
  }

  return (
    <PostalSurface className="gap-4 rounded-2xl px-4 py-5" onLayout={onLayout}>
      <Text className="text-muted-foreground text-xs">
        To: {message.to.map((recipient) => recipient.address).join(", ")}
      </Text>
      <MobileEmailBody messageId={message.id} source={message.body} />
      {message.attachments.map((attachment) => (
        <Pressable
          key={attachment.id}
          accessibilityLabel={`${attachment.name}, ${attachment.size}`}
          accessibilityRole="button"
          className="bg-well border-well-border flex-row items-center gap-3 rounded-xl border px-4 py-3"
          disabled={downloadingId !== undefined}
          onPress={() => void download(attachment)}
        >
          <Paperclip color={mutedForeground} size={18} />
          <View className="min-w-0 flex-1">
            <Text className="text-foreground font-semibold" numberOfLines={1}>
              {attachment.name}
            </Text>
            <Text className="text-muted-foreground text-xs">
              {attachment.size}
            </Text>
          </View>
          <AttachmentDownloadIcon
            isDownloading={downloadingId === attachment.id}
          />
        </Pressable>
      ))}
    </PostalSurface>
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

function AttachmentDownloadIcon({ isDownloading }: { isDownloading: boolean }) {
  const mutedForeground = useColor("muted-foreground");
  if (isDownloading) {
    return <ActivityIndicator color={mutedForeground} size="small" />;
  }
  return <Download color={mutedForeground} size={18} />;
}

function getDownloadError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "This attachment is not available yet.";
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
