import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Spacer,
  SwipeActions,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityElement,
  accessibilityHint,
  accessibilityLabel,
  background,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listStyle,
  padding,
  scrollContentBackground,
  scrollDisabled,
  scrollIndicators,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import type { MailThread } from "@rodge-mail/features/mail";

import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import { formatMessageTime } from "../lib/mail-format";
import { useMailStore } from "../store";
import {
  getPinAction,
  getReadAction,
  getSenderInitials,
  getThreadRowAccessibilityLabel,
  getThreadRowNativeKey,
  isThreadUnread,
} from "./thread-row-presentation";

const rowHeight = 100;

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
  const colorScheme = useResolvedMobileColorScheme();
  const colors = useThreadRowColors();
  const pinAction = getPinAction(thread);
  const readAction = getReadAction(thread);

  return (
    <Host
      key={getThreadRowNativeKey(thread)}
      colorScheme={colorScheme}
      seedColor={colors.primary}
      style={{
        borderRadius: 14,
        height: rowHeight,
        marginBottom: 9,
        marginHorizontal: 14,
        overflow: "hidden",
      }}
    >
      <List
        modifiers={[
          listStyle("plain"),
          scrollDisabled(true),
          scrollIndicators("hidden"),
          scrollContentBackground("hidden"),
          background(colors.paper),
        ]}
      >
        <SwipeActions
          modifiers={[
            listRowInsets({ bottom: 0, leading: 0, top: 0, trailing: 0 }),
            listRowSeparator("hidden"),
            listRowBackground(colors.paper),
          ]}
        >
          <Button
            modifiers={[
              buttonStyle("plain"),
              frame({ height: rowHeight, maxWidth: Infinity }),
              accessibilityElement("ignore"),
              accessibilityLabel(getThreadRowAccessibilityLabel(thread)),
              accessibilityHint("Opens this email thread"),
            ]}
            onPress={onOpen}
          >
            <ThreadSummary colors={colors} thread={thread} />
          </Button>
          <SwipeActions.Actions edge="leading">
            <Button
              label={pinAction.label}
              modifiers={[tint(colors.primary)]}
              systemImage={pinAction.systemImage}
              onPress={() => void togglePin(thread.id, thread.isPinned)}
            />
          </SwipeActions.Actions>
          <SwipeActions.Actions edge="trailing">
            <Button
              label="Archive"
              modifiers={[tint(colors.brass)]}
              systemImage="archivebox"
              onPress={() => void archiveThread(thread.id)}
            />
            <Button
              label={readAction.label}
              modifiers={[tint(thread.isRead ? colors.muted : colors.forest)]}
              systemImage={readAction.systemImage}
              onPress={() => void toggleRead(thread.id, thread.isRead)}
            />
          </SwipeActions.Actions>
        </SwipeActions>
      </List>
    </Host>
  );
}

function ThreadSummary({
  colors,
  thread,
}: {
  colors: ThreadRowColors;
  thread: MailThread;
}) {
  const isUnread = isThreadUnread(thread);
  const senderWeight = isUnread ? "bold" : "medium";
  const subjectWeight = isUnread ? "semibold" : "regular";

  return (
    <HStack
      alignment="center"
      spacing={10}
      modifiers={[
        frame({ height: rowHeight, maxWidth: Infinity, alignment: "leading" }),
        padding({ leading: 12, trailing: 12 }),
      ]}
    >
      <UnreadIndicator colors={colors} isUnread={isUnread} />
      <SenderAvatar colors={colors} thread={thread} />
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <HStack spacing={7} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text
            modifiers={[
              font({ size: 15, weight: senderWeight }),
              foregroundStyle(colors.foreground),
              lineLimit(1),
            ]}
          >
            {thread.sender.name}
          </Text>
          <Spacer />
          <PinIndicator color={colors.brass} isPinned={thread.isPinned} />
          <Text
            modifiers={[
              font({ size: 12, weight: thread.isRead ? "regular" : "medium" }),
              foregroundStyle(colors.mutedForeground),
              lineLimit(1),
            ]}
          >
            {formatMessageTime(thread.receivedAt)}
          </Text>
        </HStack>
        <Text
          modifiers={[
            font({ size: 14, weight: subjectWeight }),
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
  colors: ThreadRowColors;
  thread: MailThread;
}) {
  return (
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
  );
}

function UnreadIndicator({
  colors,
  isUnread,
}: {
  colors: ThreadRowColors;
  isUnread: boolean;
}) {
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

function useThreadRowColors() {
  return {
    brass: useColor("brass"),
    foreground: useColor("foreground"),
    forest: useColor("forest-raised"),
    muted: useColor("muted"),
    mutedForeground: useColor("muted-foreground"),
    paper: useColor("paper"),
    paperDeep: useColor("paper-deep"),
    primary: useColor("primary"),
  };
}

type ThreadRowColors = ReturnType<typeof useThreadRowColors>;
