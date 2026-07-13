import { HStack, Image, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  background,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";

import type { MailThread } from "@rodge-mail/features/mail";

import { formatMessageTime } from "../lib/mail-format";
import { getSenderInitials, isThreadUnread } from "./thread-row-presentation";

const rowHeight = 100;

export interface NativeThreadRowColors {
  brass: string;
  destructive: string;
  foreground: string;
  forest: string;
  muted: string;
  mutedForeground: string;
  paper: string;
  paperDeep: string;
  primary: string;
}

export function NativeThreadSummary({
  colors,
  mailbox,
  selected,
  selectionMode,
  thread,
}: {
  colors: NativeThreadRowColors;
  mailbox: "archive" | "inbox";
  selected: boolean;
  selectionMode: boolean;
  thread: MailThread;
}) {
  const isUnread = isThreadUnread(thread);
  return (
    <HStack
      alignment="center"
      spacing={10}
      modifiers={[
        frame({ height: rowHeight, maxWidth: Infinity, alignment: "leading" }),
        padding({ leading: 12, trailing: 12 }),
      ]}
    >
      <SenderAvatar
        colors={colors}
        selected={selected}
        selectionMode={selectionMode}
        thread={thread}
      />
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <HStack spacing={7} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text
            modifiers={[
              font({ size: 15, weight: isUnread ? "bold" : "medium" }),
              foregroundStyle(colors.foreground),
              lineLimit(1),
            ]}
          >
            {thread.sender.name}
          </Text>
          <Spacer />
          <PinIndicator
            color={colors.brass}
            isPinned={mailbox === "inbox" && thread.isPinned}
          />
          <Text
            modifiers={[
              font({ size: 12, weight: isUnread ? "medium" : "regular" }),
              foregroundStyle(colors.mutedForeground),
              lineLimit(1),
            ]}
          >
            {formatMessageTime(thread.receivedAt)}
          </Text>
        </HStack>
        <Text
          modifiers={[
            font({ size: 14, weight: isUnread ? "semibold" : "regular" }),
            foregroundStyle(colors.foreground),
            lineLimit(1),
          ]}
        >
          {thread.subject}
        </Text>
        <Text
          modifiers={[
            font({ size: 13 }),
            foregroundStyle(colors.mutedForeground),
            lineLimit(1),
          ]}
        >
          {thread.preview}
        </Text>
      </VStack>
    </HStack>
  );
}

function SenderAvatar({
  colors,
  selected,
  selectionMode,
  thread,
}: {
  colors: NativeThreadRowColors;
  selected: boolean;
  selectionMode: boolean;
  thread: MailThread;
}) {
  return (
    <ZStack
      alignment="topTrailing"
      modifiers={[frame({ height: 40, width: 40 })]}
    >
      <Text
        modifiers={[
          frame({ height: 40, width: 40 }),
          font({ size: 13, weight: "semibold" }),
          foregroundStyle(colors.foreground),
          background(
            colors.paperDeep,
            shapes.roundedRectangle({
              cornerRadius: 11,
              roundedCornerStyle: "continuous",
            }),
          ),
        ]}
      >
        {getSenderInitials(thread.sender.name)}
      </Text>
      <AvatarIndicator
        colors={colors}
        isUnread={isThreadUnread(thread)}
        selected={selected}
        selectionMode={selectionMode}
      />
    </ZStack>
  );
}

function AvatarIndicator({
  colors,
  isUnread,
  selected,
  selectionMode,
}: {
  colors: NativeThreadRowColors;
  isUnread: boolean;
  selected: boolean;
  selectionMode: boolean;
}) {
  if (selectionMode) {
    return (
      <Image
        color={selected ? colors.primary : colors.mutedForeground}
        size={16}
        systemName={selected ? "checkmark.circle.fill" : "circle"}
      />
    );
  }
  return (
    <Image
      color={isUnread ? colors.brass : "transparent"}
      size={8}
      systemName="circle.fill"
    />
  );
}

function PinIndicator({
  color,
  isPinned,
}: {
  color: string;
  isPinned: boolean;
}) {
  if (!isPinned) return null;
  return <Image color={color} size={12} systemName="pin.fill" />;
}
