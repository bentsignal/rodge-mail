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
            listRowBackground(thread.isRead ? colors.paper : colors.paperDeep),
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
  const senderWeight = thread.isRead ? "medium" : "bold";
  const subjectWeight = thread.isRead ? "regular" : "semibold";

  return (
    <HStack
      alignment="center"
      spacing={12}
      modifiers={[
        frame({ height: rowHeight, maxWidth: Infinity, alignment: "leading" }),
        padding({ leading: 14, trailing: 12 }),
      ]}
    >
      <UnreadRail color={colors.brass} isRead={thread.isRead} />
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
        frame({ height: 42, width: 42 }),
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

function UnreadRail({ color, isRead }: { color: string; isRead: boolean }) {
  return (
    <Text
      modifiers={[
        frame({ height: 64, width: 4 }),
        background(isRead ? "clear" : color, shapes.capsule()),
      ]}
    >
      {" "}
    </Text>
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
