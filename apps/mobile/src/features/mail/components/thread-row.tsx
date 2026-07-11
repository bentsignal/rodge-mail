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
  const shadowColor = useColor("shadow-color");

  return (
    <Pressable
      accessibilityHint="Opens this email thread"
      accessibilityLabel={`${thread.sender.name}, ${thread.subject}`}
      accessibilityRole="button"
      className="bg-card border-brass/25 mx-3 mb-2 flex-row gap-3 rounded-2xl border px-4 py-3.5"
      onPress={onOpen}
      style={{
        elevation: 1,
        shadowColor,
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }}
    >
      <View className="pt-1">
        <View
          className={
            thread.isRead
              ? "bg-muted size-2 rounded-full"
              : "bg-stamp size-2 rounded-full"
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
      <ThreadActions
        thread={thread}
        onPin={() => togglePin(thread.id, thread.isPinned)}
        onRead={() => toggleRead(thread.id, thread.isRead)}
      />
    </Pressable>
  );
}

function ThreadActions({
  onPin,
  onRead,
  thread,
}: {
  onPin: () => void;
  onRead: () => void;
  thread: MailThread;
}) {
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");

  return (
    <View className="self-start">
      <Pressable
        accessibilityLabel={thread.isPinned ? "Unpin thread" : "Pin thread"}
        accessibilityRole="button"
        className="bg-well/70 rounded-full p-2"
        hitSlop={8}
        onPress={(event) => {
          event.stopPropagation();
          onPin();
        }}
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
        onPress={(event) => {
          event.stopPropagation();
          onRead();
        }}
      >
        <ReadIcon isRead={thread.isRead} color={mutedForeground} />
      </Pressable>
    </View>
  );
}

function ReadIcon({ isRead, color }: { isRead: boolean; color: string }) {
  if (isRead) return <Mail color={color} size={17} />;
  return <MailOpen color={color} size={17} />;
}
