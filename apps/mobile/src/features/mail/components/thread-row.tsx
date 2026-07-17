import { Pressable, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  Archive,
  ArchiveRestore,
  Mail,
  MailOpen,
  Pin,
  Trash2,
} from "lucide-react-native";

import type { MailThread } from "@rodge-mail/features/mail";

import type { MobileMailbox } from "../store";
import type { ThreadRowProps } from "./thread-row-types";
import { useColor } from "~/hooks/use-color";
import { useMailStore } from "../store";
import { runAfterSwipeAnimation } from "./thread-row-presentation";
import { FallbackThreadSummary } from "./thread-row-summary-fallback";

export function ThreadRow(props: ThreadRowProps) {
  const {
    mailbox = "inbox",
    onOpen,
    onSelect,
    selected = false,
    selectionMode = false,
    thread,
  } = props;
  const togglePin = useMailStore((store) => store.togglePin);
  const shadowColor = useColor("shadow-color");

  function pin() {
    void togglePin(thread.id, thread.isPinned);
  }

  const open = selectionMode && onSelect ? onSelect : onOpen;
  return (
    <ReanimatedSwipeable
      key={thread.id}
      containerStyle={{ marginBottom: -1, marginHorizontal: 14 }}
      enabled={!selectionMode && mailbox !== "spam"}
      enableTrackpadTwoFingerGesture
      friction={1.6}
      leftThreshold={48}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(_progress, _translation, swipeable) => (
        <ThreadLeftAction
          close={swipeable.close}
          mailbox={mailbox}
          onPin={pin}
          onRestore={props.onRestore}
          thread={thread}
        />
      )}
      renderRightActions={(_progress, _translation, swipeable) => (
        <ThreadRightActions
          close={swipeable.close}
          mailbox={mailbox}
          onDelete={props.onDelete}
          thread={thread}
        />
      )}
      rightThreshold={48}
    >
      <FallbackThreadSummary
        mailbox={mailbox}
        onOpen={open}
        onPin={pin}
        selected={selected}
        selectionMode={selectionMode}
        shadowColor={shadowColor}
        thread={thread}
      />
    </ReanimatedSwipeable>
  );
}

function ThreadLeftAction({
  close,
  mailbox,
  onPin,
  onRestore,
  thread,
}: {
  close: () => void;
  mailbox: MobileMailbox;
  onPin: () => void;
  onRestore?: () => void;
  thread: MailThread;
}) {
  const foreground = useColor("primary-foreground");
  if (mailbox === "spam") return null;
  if (mailbox === "archive") {
    return (
      <SwipeAction
        label="Restore"
        onPress={() => {
          close();
          runAfterSwipeAnimation(() => onRestore?.());
        }}
      >
        <ArchiveRestore color={foreground} size={19} />
      </SwipeAction>
    );
  }
  return (
    <SwipeAction
      label={thread.isPinned ? "Unpin" : "Pin"}
      onPress={() => {
        close();
        runAfterSwipeAnimation(onPin);
      }}
    >
      <Pin
        color={foreground}
        fill={thread.isPinned ? foreground : "transparent"}
        size={19}
      />
    </SwipeAction>
  );
}

function ThreadRightActions({
  close,
  mailbox,
  onDelete,
  thread,
}: {
  close: () => void;
  mailbox: MobileMailbox;
  onDelete?: () => void;
  thread: MailThread;
}) {
  const archiveThread = useMailStore((store) => store.archiveThread);
  const toggleRead = useMailStore((store) => store.toggleRead);
  const foreground = useColor("primary-foreground");
  const destructive = useColor("destructive");
  const destructiveForeground = useColor("destructive-foreground");
  if (mailbox === "spam") return null;
  if (mailbox === "archive") {
    return (
      <SwipeAction
        backgroundColor={destructive}
        foregroundColor={destructiveForeground}
        label="Delete"
        onPress={() => {
          close();
          runAfterSwipeAnimation(() => onDelete?.());
        }}
      >
        <Trash2 color={destructiveForeground} size={19} />
      </SwipeAction>
    );
  }
  return (
    <View className="flex-row">
      <SwipeAction
        label={thread.isRead ? "Unread" : "Read"}
        onPress={() => {
          close();
          runAfterSwipeAnimation(
            () => void toggleRead(thread.id, thread.isRead),
          );
        }}
      >
        <ReadIcon isRead={thread.isRead} color={foreground} />
      </SwipeAction>
      <SwipeAction
        label="Archive"
        onPress={() => {
          close();
          runAfterSwipeAnimation(() => void archiveThread(thread.id));
        }}
      >
        <Archive color={foreground} size={19} />
      </SwipeAction>
    </View>
  );
}

function SwipeAction({
  backgroundColor,
  children,
  foregroundColor,
  label,
  onPress,
}: {
  backgroundColor?: string;
  children: React.ReactNode;
  foregroundColor?: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="bg-primary w-24 items-center justify-center gap-1 rounded-2xl"
      onPress={onPress}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      {children}
      <Text
        className="text-primary-foreground text-xs font-semibold"
        style={foregroundColor ? { color: foregroundColor } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ReadIcon({ isRead, color }: { isRead: boolean; color: string }) {
  if (isRead) return <Mail color={color} size={17} />;
  return <MailOpen color={color} size={17} />;
}
