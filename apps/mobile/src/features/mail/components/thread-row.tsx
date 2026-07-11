import { Pressable, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
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
  const primaryForeground = useColor("primary-foreground");

  function pin() {
    void togglePin(thread.id, thread.isPinned);
  }

  function toggleThreadRead() {
    void toggleRead(thread.id, thread.isRead);
  }

  return (
    <ReanimatedSwipeable
      containerStyle={{ marginBottom: 8, marginHorizontal: 12 }}
      enableTrackpadTwoFingerGesture
      friction={1.4}
      leftThreshold={48}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(_progress, _translation, swipeable) => (
        <SwipeAction
          label={thread.isPinned ? "Unpin" : "Pin"}
          onPress={() => {
            swipeable.close();
            pin();
          }}
        >
          <Pin
            color={primaryForeground}
            fill={thread.isPinned ? primaryForeground : "transparent"}
            size={19}
          />
        </SwipeAction>
      )}
      renderRightActions={(_progress, _translation, swipeable) => (
        <SwipeAction
          label={thread.isRead ? "Unread" : "Read"}
          onPress={() => {
            swipeable.close();
            toggleThreadRead();
          }}
        >
          <ReadIcon isRead={thread.isRead} color={primaryForeground} />
        </SwipeAction>
      )}
      rightThreshold={48}
    >
      <ThreadSummary
        onOpen={onOpen}
        onPin={pin}
        onRead={toggleThreadRead}
        shadowColor={shadowColor}
        thread={thread}
      />
    </ReanimatedSwipeable>
  );
}

function ThreadSummary({
  onOpen,
  onPin,
  onRead,
  shadowColor,
  thread,
}: {
  onOpen: () => void;
  onPin: () => void;
  onRead: () => void;
  shadowColor: string;
  thread: MailThread;
}) {
  return (
    <Pressable
      accessibilityHint="Opens this email thread"
      accessibilityLabel={`${thread.sender.name}, ${thread.subject}`}
      accessibilityRole="button"
      className="bg-card border-brass/25 flex-row gap-3 rounded-2xl border px-4 py-3.5"
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
      <ThreadActions thread={thread} onPin={onPin} onRead={onRead} />
    </Pressable>
  );
}

function SwipeAction({
  children,
  label,
  onPress,
}: {
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="bg-primary w-24 items-center justify-center gap-1 rounded-2xl"
      onPress={onPress}
    >
      {children}
      <Text className="text-primary-foreground text-xs font-semibold">
        {label}
      </Text>
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
