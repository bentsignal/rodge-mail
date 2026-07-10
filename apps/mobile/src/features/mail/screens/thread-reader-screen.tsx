import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Paperclip, Pin, Reply } from "lucide-react-native";

import type { MailMessage, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";
import { toMailThreadDetail } from "../lib/convex-mail";
import { formatMessageTime } from "../lib/mail-format";

export function ThreadReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = id ? toConvexId<"threads">(id) : undefined;
  const queryArgs = threadId ? { threadId } : "skip";
  const thread = useQuery(api.mail.queries.getThread, queryArgs);

  if (thread === undefined && threadId) return <ThreadLoading />;
  if (!thread) return <ThreadNotFound />;
  return <ThreadReader thread={toMailThreadDetail(thread)} />;
}

function ThreadReader({ thread }: { thread: MailThread }) {
  const router = useRouter();
  const setThreadPinned = useMutation(api.mail.mutations.setThreadPinned);
  const background = useColor("background");
  const foreground = useColor("foreground");

  function reply() {
    router.push({
      pathname: "/compose",
      params: {
        to: thread.sender.address,
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
            <Pressable
              accessibilityLabel={
                thread.isPinned ? "Unpin thread" : "Pin thread"
              }
              accessibilityRole="button"
              hitSlop={12}
              onPress={() =>
                void setThreadPinned({
                  threadId: toConvexId<"threads">(thread.id),
                  isPinned: !thread.isPinned,
                })
              }
            >
              <Pin
                color={foreground}
                fill={thread.isPinned ? foreground : "transparent"}
                size={19}
              />
            </Pressable>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <ScrollView
          contentContainerClassName="gap-6 px-5 pt-4 pb-28"
          contentInsetAdjustmentBehavior="automatic"
        >
          <ThreadHeader thread={thread} />
          {thread.messages.map((message) => (
            <MessageBody key={message.id} message={message} />
          ))}
        </ScrollView>
        <Pressable
          accessibilityLabel="Reply"
          accessibilityRole="button"
          className="bg-foreground absolute right-5 bottom-5 flex-row items-center gap-2 rounded-full px-5 py-3"
          onPress={reply}
        >
          <Reply color={background} size={17} />
          <Text className="text-background font-semibold">Reply</Text>
        </Pressable>
      </View>
    </>
  );
}

function ThreadHeader({ thread }: { thread: MailThread }) {
  return (
    <View className="gap-4">
      <Text className="text-foreground text-3xl leading-9 font-bold">
        {thread.subject}
      </Text>
      <View className="flex-row items-center gap-3">
        <View className="bg-muted size-11 items-center justify-center rounded-full">
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
      <PriorityReason note={thread.priorityNote} />
    </View>
  );
}

function PriorityReason({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <View className="bg-primary/10 rounded-xl px-3 py-2">
      <Text className="text-primary text-sm font-medium">
        Focused because: {note}
      </Text>
    </View>
  );
}

function MessageBody({ message }: { message: MailMessage }) {
  return (
    <View className="gap-4">
      <Text className="text-muted-foreground text-xs">
        To: {message.to.map((recipient) => recipient.address).join(", ")}
      </Text>
      {message.body.map((paragraph, index) => (
        <Text
          key={`${message.id}-${index}`}
          className="text-foreground text-[16px] leading-7"
          selectable
        >
          {paragraph}
        </Text>
      ))}
      {message.attachments.map((attachment) => (
        <View
          key={attachment.id}
          accessibilityLabel={`${attachment.name}, ${attachment.size}`}
          className="bg-muted flex-row items-center gap-3 rounded-xl px-4 py-3"
        >
          <Paperclip color="#777777" size={18} />
          <View className="min-w-0 flex-1">
            <Text className="text-foreground font-semibold" numberOfLines={1}>
              {attachment.name}
            </Text>
            <Text className="text-muted-foreground text-xs">
              {attachment.size}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
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
