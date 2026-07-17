import { Button, Host, List, SwipeActions } from "@expo/ui/swift-ui";
import {
  accessibilityElement,
  accessibilityHint,
  accessibilityLabel,
  background,
  buttonStyle,
  environment,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listStyle,
  scrollContentBackground,
  scrollDisabled,
  scrollIndicators,
  tag,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import type { MailThread } from "@rodge-mail/features/mail";

import type { NativeThreadRowColors } from "./thread-row-summary.ios";
import type { ThreadRowProps } from "./thread-row-types";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import { useMailStore } from "../store";
import {
  getPinAction,
  getReadAction,
  getThreadRowAccessibilityLabel,
  getThreadRowNativeKey,
  runAfterSwipeAnimation,
} from "./thread-row-presentation";
import { NativeThreadSummary } from "./thread-row-summary.ios";

const rowHeight = 100;

export function ThreadRow(props: ThreadRowProps) {
  const {
    mailbox = "inbox",
    selected = false,
    selectionMode = false,
    thread,
  } = props;
  const colorScheme = useResolvedMobileColorScheme();
  const colors = useThreadRowColors();

  return (
    <Host
      key={getNativeKey(thread, mailbox)}
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
        selection={selectionMode ? (selected ? [thread.id] : []) : undefined}
        modifiers={[
          listStyle("plain"),
          scrollDisabled(true),
          scrollIndicators("hidden"),
          scrollContentBackground("hidden"),
          background(colors.paper),
          environment("editMode", selectionMode ? "active" : "inactive"),
        ]}
        onSelectionChange={
          selectionMode
            ? (selection) => {
                const nextSelected = selection.includes(thread.id);
                if (nextSelected !== selected) props.onSelect?.();
              }
            : undefined
        }
      >
        <NativeRowContent colors={colors} props={props} />
      </List>
    </Host>
  );
}

function NativeRowContent({
  colors,
  props,
}: {
  colors: NativeThreadRowColors;
  props: ThreadRowProps;
}) {
  const mailbox = props.mailbox ?? "inbox";
  if (props.selectionMode) {
    return <NativeSelectableThread colors={colors} props={props} />;
  }
  if (mailbox === "archive") {
    return <ArchiveSwipeRow colors={colors} props={props} />;
  }
  return <InboxSwipeRow colors={colors} props={props} />;
}

function NativeSelectableThread({
  colors,
  props,
}: {
  colors: NativeThreadRowColors;
  props: ThreadRowProps;
}) {
  const { mailbox = "inbox", thread } = props;
  return (
    <NativeThreadSummary
      colors={colors}
      mailbox={mailbox}
      modifiers={[
        tag(thread.id),
        accessibilityElement("ignore"),
        accessibilityLabel(getNativeAccessibilityLabel(props)),
        accessibilityHint("Toggles selection"),
        ...rowModifiers(colors.paper),
      ]}
      thread={thread}
    />
  );
}

function NativeThreadButton({
  colors,
  props,
}: {
  colors: NativeThreadRowColors;
  props: ThreadRowProps;
}) {
  const { mailbox = "inbox", onOpen, thread } = props;
  return (
    <Button
      modifiers={[
        buttonStyle("plain"),
        frame({ height: rowHeight, maxWidth: Infinity }),
        accessibilityElement("ignore"),
        accessibilityLabel(getNativeAccessibilityLabel(props)),
        accessibilityHint("Opens this email thread"),
        ...rowModifiers(colors.paper),
      ]}
      onPress={onOpen}
    >
      <NativeThreadSummary colors={colors} mailbox={mailbox} thread={thread} />
    </Button>
  );
}

function InboxSwipeRow({
  colors,
  props,
}: {
  colors: NativeThreadRowColors;
  props: ThreadRowProps;
}) {
  const togglePin = useMailStore((store) => store.togglePin);
  const toggleRead = useMailStore((store) => store.toggleRead);
  const archiveThread = useMailStore((store) => store.archiveThread);
  const pinAction = getPinAction(props.thread);
  const readAction = getReadAction(props.thread);
  return (
    <SwipeActions modifiers={rowModifiers(colors.paper)}>
      <NativeThreadButton colors={colors} props={props} />
      <SwipeActions.Actions edge="leading">
        <Button
          label={pinAction.label}
          modifiers={[tint(colors.primary)]}
          systemImage={pinAction.systemImage}
          onPress={() =>
            runAfterSwipeAnimation(
              () => void togglePin(props.thread.id, props.thread.isPinned),
            )
          }
        />
      </SwipeActions.Actions>
      <SwipeActions.Actions edge="trailing">
        <Button
          label="Archive"
          modifiers={[tint(colors.brass)]}
          systemImage="archivebox"
          onPress={() =>
            runAfterSwipeAnimation(() => void archiveThread(props.thread.id))
          }
        />
        <Button
          label={readAction.label}
          modifiers={[tint(props.thread.isRead ? colors.muted : colors.forest)]}
          systemImage={readAction.systemImage}
          onPress={() =>
            runAfterSwipeAnimation(
              () => void toggleRead(props.thread.id, props.thread.isRead),
            )
          }
        />
      </SwipeActions.Actions>
    </SwipeActions>
  );
}

function ArchiveSwipeRow({
  colors,
  props,
}: {
  colors: NativeThreadRowColors;
  props: ThreadRowProps;
}) {
  return (
    <SwipeActions modifiers={rowModifiers(colors.paper)}>
      <NativeThreadButton colors={colors} props={props} />
      <SwipeActions.Actions edge="leading">
        <Button
          label="Restore"
          modifiers={[tint(colors.forest)]}
          systemImage="arrow.uturn.backward"
          onPress={props.onRestore}
        />
      </SwipeActions.Actions>
      <SwipeActions.Actions edge="trailing">
        <Button
          label="Delete"
          modifiers={[tint(colors.destructive)]}
          role="destructive"
          systemImage="trash"
          onPress={props.onDelete}
        />
      </SwipeActions.Actions>
    </SwipeActions>
  );
}

function getNativeAccessibilityLabel(props: ThreadRowProps) {
  const label = getThreadRowAccessibilityLabel(props.thread);
  if (!props.selectionMode) return label;
  return `${props.selected ? "Selected" : "Not selected"}, ${label}`;
}

function getNativeKey(thread: MailThread, mailbox: "archive" | "inbox") {
  return `${getThreadRowNativeKey(thread)}:${mailbox}`;
}

function rowModifiers(paper: string) {
  return [
    listRowInsets({ bottom: 0, leading: 0, top: 0, trailing: 0 }),
    listRowSeparator("hidden"),
    listRowBackground(paper),
  ];
}

function useThreadRowColors() {
  return {
    brass: useColor("brass"),
    destructive: useColor("destructive"),
    foreground: useColor("foreground"),
    forest: useColor("forest-raised"),
    muted: useColor("muted"),
    mutedForeground: useColor("muted-foreground"),
    paper: useColor("paper"),
    paperDeep: useColor("paper-deep"),
    primary: useColor("primary"),
  };
}
