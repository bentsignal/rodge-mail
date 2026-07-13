import type { ViewModifier } from "@expo/ui/swift-ui/modifiers";
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

import type { MobileMailbox } from "../store";
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
  modifiers,
  thread,
}: {
  colors: NativeThreadRowColors;
  mailbox: MobileMailbox;
  modifiers?: ViewModifier[];
  thread: MailThread;
}) {
  return (
    <HStack
      alignment="center"
      spacing={10}
      modifiers={[
        frame({ height: rowHeight, maxWidth: Infinity, alignment: "leading" }),
        padding({ leading: 12, trailing: 12 }),
        ...(modifiers ?? []),
      ]}
    >
      <SenderAvatar colors={colors} thread={thread} />
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <HStack spacing={7} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text
            modifiers={[
              font({ size: 15, weight: "medium" }),
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
              font({ size: 12, weight: "regular" }),
              foregroundStyle(colors.mutedForeground),
              lineLimit(1),
            ]}
          >
            {formatMessageTime(thread.receivedAt)}
          </Text>
        </HStack>
        <Text
          modifiers={[
            font({ size: 14, weight: "regular" }),
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
  thread,
}: {
  colors: NativeThreadRowColors;
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
      <AvatarIndicator colors={colors} isUnread={isThreadUnread(thread)} />
    </ZStack>
  );
}

function AvatarIndicator({
  colors,
  isUnread,
}: {
  colors: NativeThreadRowColors;
  isUnread: boolean;
}) {
  if (!isUnread) return null;
  return <Image color={colors.brass} size={8} systemName="circle.fill" />;
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
