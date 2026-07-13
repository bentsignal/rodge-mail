import { Pressable, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Archive, Mail, MailOpen, Pin } from "lucide-react-native";

import type { MailThread } from "@rodge-mail/features/mail";

import { useColor } from "~/hooks/use-color";
import { formatMessageTime } from "../lib/mail-format";
import { useMailStore } from "../store";
import {
  getSenderInitials,
  getThreadRowAccessibilityLabel,
  isThreadUnread,
} from "./thread-row-presentation";

export function ThreadRow({
  thread,
  onOpen,
}: {
  thread: MailThread;
  onOpen: () => void;
}) {
  const togglePin = useMailStore((store) => store.togglePin);
  const toggleRead = useMailStore((store) => store.toggleRead);
  const archiveThread = useMailStore((store) => store.archiveThread);
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
      key={thread.id}
      containerStyle={{ marginBottom: -1, marginHorizontal: 14 }}
      enableTrackpadTwoFingerGesture
      friction={1.6}
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
        <View className="flex-row">
          <SwipeAction
            label={thread.isRead ? "Unread" : "Read"}
            onPress={() => {
              swipeable.close();
              toggleThreadRead();
            }}
          >
            <ReadIcon isRead={thread.isRead} color={primaryForeground} />
          </SwipeAction>
          <SwipeAction
            label="Archive"
            onPress={() => {
              swipeable.close();
              void archiveThread(thread.id);
            }}
          >
            <Archive color={primaryForeground} size={19} />
          </SwipeAction>
        </View>
      )}
      rightThreshold={48}
    >
      <ThreadSummary
        onOpen={onOpen}
        onPin={pin}
        shadowColor={shadowColor}
        thread={thread}
      />
    </ReanimatedSwipeable>
  );
}

function ThreadSummary({
  onOpen,
  onPin,
  shadowColor,
  thread,
}: {
  onOpen: () => void;
  onPin: () => void;
  shadowColor: string;
  thread: MailThread;
}) {
  const isUnread = isThreadUnread(thread);

  return (
    <Pressable
      accessibilityHint="Opens this email thread"
      accessibilityLabel={getThreadRowAccessibilityLabel(thread)}
      accessibilityRole="button"
      className="bg-paper border-paper-border min-h-[94px] flex-row gap-3 rounded-xl border px-4 py-3"
      onPress={onOpen}
      style={({ pressed }) => ({
        elevation: pressed ? 0 : 1,
        shadowColor,
        shadowOffset: { height: 1, width: 0 },
        shadowOpacity: pressed ? 0.04 : 0.08,
        shadowRadius: 2,
        transform: [{ translateY: pressed ? 1 : 0 }],
      })}
    >
      <UnreadIndicator isUnread={isUnread} />
      <View className="bg-paper-deep border-paper-border size-10 items-center justify-center rounded-lg border">
        <Text className="text-foreground text-xs font-semibold">
          {getSenderInitials(thread.sender.name)}
        </Text>
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text
            className={
              thread.isRead
                ? "text-foreground min-w-0 flex-1 text-sm"
                : "text-foreground min-w-0 flex-1 text-sm font-bold"
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
          className="text-muted-foreground text-[13px] leading-[18px]"
          numberOfLines={1}
        >
          {thread.preview}
        </Text>
      </View>
      <ThreadPinAction thread={thread} onPin={onPin} />
    </Pressable>
  );
}

function UnreadIndicator({ isUnread }: { isUnread: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      className={`mt-1.5 size-2 rounded-full ${isUnread ? "bg-brass" : "bg-transparent"}`}
      importantForAccessibility="no-hide-descendants"
    />
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

function ThreadPinAction({
  onPin,
  thread,
}: {
  onPin: () => void;
  thread: MailThread;
}) {
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");

  return (
    <Pressable
      accessibilityLabel={thread.isPinned ? "Unpin thread" : "Pin thread"}
      accessibilityRole="button"
      className="size-11 items-center justify-center rounded-lg"
      hitSlop={4}
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
  );
}

function ReadIcon({ isRead, color }: { isRead: boolean; color: string }) {
  if (isRead) return <Mail color={color} size={17} />;
  return <MailOpen color={color} size={17} />;
}
