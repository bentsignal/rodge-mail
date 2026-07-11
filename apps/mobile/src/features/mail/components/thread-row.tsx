import type { GestureResponderEvent } from "react-native";
import { Pressable, Text, View } from "react-native";
import { Mail, MailOpen, Pin } from "lucide-react-native";

import type { MailThread } from "@rodge-mail/features/mail";

import { useColor } from "~/hooks/use-color";
import { formatMessageTime } from "../lib/mail-format";
import { useMailStore } from "../store";

export function ThreadRow({
  thread,
  onOpen,
}: {
  thread: MailThread;
  onOpen: () => void;
}) {
  const togglePin = useMailStore((store) => store.togglePin);
  const toggleRead = useMailStore((store) => store.toggleRead);
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");

  function handlePin(event: GestureResponderEvent) {
    event.stopPropagation();
    togglePin(thread.id, thread.isPinned);
  }

  function handleRead(event: GestureResponderEvent) {
    event.stopPropagation();
    toggleRead(thread.id, thread.isRead);
  }

  return (
    <Pressable
      accessibilityHint="Opens this email thread"
      accessibilityLabel={`${thread.sender.name}, ${thread.subject}`}
      accessibilityRole="button"
      className="border-border flex-row gap-3 border-b px-4 py-4"
      onPress={onOpen}
    >
      <View className="pt-1">
        <View
          className={
            thread.isRead
              ? "bg-muted size-2 rounded-full"
              : "bg-primary size-2 rounded-full"
          }
        />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text
            className={
              thread.isRead
                ? "text-foreground min-w-0 flex-1 text-base"
                : "text-foreground min-w-0 flex-1 text-base font-bold"
            }
            numberOfLines={1}
          >
            {thread.sender.name}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {formatMessageTime(thread.receivedAt)}
          </Text>
        </View>
        <Text
          className={
            thread.isRead
              ? "text-foreground text-sm"
              : "text-foreground text-sm font-semibold"
          }
          numberOfLines={1}
        >
          {thread.subject}
        </Text>
        <Text
          className="text-muted-foreground text-sm leading-5"
          numberOfLines={2}
        >
          {thread.preview}
        </Text>
      </View>
      <View className="self-start">
        <Pressable
          accessibilityLabel={thread.isPinned ? "Unpin thread" : "Pin thread"}
          accessibilityRole="button"
          className="rounded-full p-2"
          hitSlop={8}
          onPress={handlePin}
        >
          <Pin
            color={thread.isPinned ? foreground : mutedForeground}
            fill={thread.isPinned ? foreground : "transparent"}
            size={17}
          />
        </Pressable>
        <Pressable
          accessibilityLabel={thread.isRead ? "Mark unread" : "Mark read"}
          accessibilityRole="button"
          className="rounded-full p-2"
          hitSlop={8}
          onPress={handleRead}
        >
          <ReadIcon isRead={thread.isRead} color={mutedForeground} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function ReadIcon({ isRead, color }: { isRead: boolean; color: string }) {
  if (isRead) return <Mail color={color} size={17} />;
  return <MailOpen color={color} size={17} />;
}
