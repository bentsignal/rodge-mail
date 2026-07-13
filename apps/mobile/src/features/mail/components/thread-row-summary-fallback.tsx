import { Pressable, Text, View } from "react-native";
import { CheckCircle2, Circle, Pin } from "lucide-react-native";

import type { MailThread } from "@rodge-mail/features/mail";

import type { MobileMailbox } from "../store";
import { useColor } from "~/hooks/use-color";
import { formatMessageTime } from "../lib/mail-format";
import {
  getSenderInitials,
  getThreadRowAccessibilityLabel,
  isThreadUnread,
} from "./thread-row-presentation";

export function FallbackThreadSummary({
  mailbox,
  onOpen,
  onPin,
  selected,
  selectionMode,
  shadowColor,
  thread,
}: {
  mailbox: MobileMailbox;
  onOpen: () => void;
  onPin: () => void;
  selected: boolean;
  selectionMode: boolean;
  shadowColor: string;
  thread: MailThread;
}) {
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
      <SelectionIndicator selected={selected} selectionMode={selectionMode} />
      <SenderAvatar thread={thread} />
      <ThreadText thread={thread} />
      <ThreadPinSlot
        mailbox={mailbox}
        onPin={onPin}
        selectionMode={selectionMode}
        thread={thread}
      />
    </Pressable>
  );
}

function SenderAvatar({ thread }: { thread: MailThread }) {
  return (
    <View className="bg-paper-deep border-paper-border relative size-10 items-center justify-center rounded-lg border">
      <Text className="text-foreground text-xs font-semibold">
        {getSenderInitials(thread.sender.name)}
      </Text>
      <AvatarIndicator isUnread={isThreadUnread(thread)} />
    </View>
  );
}

function ThreadText({ thread }: { thread: MailThread }) {
  return (
    <View className="min-w-0 flex-1 gap-1">
      <View className="flex-row items-center gap-2">
        <Text
          className="text-foreground min-w-0 flex-1 text-sm font-medium"
          numberOfLines={1}
        >
          {thread.sender.name}
        </Text>
        <Text className="text-muted-foreground text-xs">
          {formatMessageTime(thread.receivedAt)}
        </Text>
      </View>
      <Text className="text-foreground text-sm" numberOfLines={1}>
        {thread.subject}
      </Text>
      <Text
        className="text-muted-foreground text-[13px] leading-[18px]"
        numberOfLines={1}
      >
        {thread.preview}
      </Text>
    </View>
  );
}

function AvatarIndicator({ isUnread }: { isUnread: boolean }) {
  if (!isUnread) return null;
  return (
    <View
      accessibilityElementsHidden
      className="border-paper bg-brass absolute -top-1 -right-1 size-2.5 rounded-full border"
      importantForAccessibility="no-hide-descendants"
    />
  );
}

function SelectionIndicator({
  selected,
  selectionMode,
}: {
  selected: boolean;
  selectionMode: boolean;
}) {
  const primary = useColor("primary");
  if (!selectionMode) return null;
  return (
    <View className="size-6 items-center justify-center self-center">
      <SelectionIcon color={primary} selected={selected} />
    </View>
  );
}

function SelectionIcon({
  color,
  selected,
}: {
  color: string;
  selected: boolean;
}) {
  if (!selected) return <Circle color={color} size={23} />;
  return <CheckCircle2 color={color} size={23} />;
}

function ThreadPinSlot({
  mailbox,
  onPin,
  selectionMode,
  thread,
}: {
  mailbox: MobileMailbox;
  onPin: () => void;
  selectionMode: boolean;
  thread: MailThread;
}) {
  if (mailbox !== "inbox" || selectionMode) return null;
  return <ThreadPinAction thread={thread} onPin={onPin} />;
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
