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

import type { NativeThreadRowColors } from "./thread-row-summary.ios";
import type { ThreadRowProps } from "./thread-row-types";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import { useMailStore } from "../store";
import {
  getPinAction,
  getReadAction,
  getRowMailbox,
  getThreadRowAccessibilityLabel,
  runAfterSwipeAnimation,
} from "./thread-row-presentation";
import { NativeThreadSummary } from "./thread-row-summary.ios";

const rowHeight = 100;

export function ThreadRow(props: ThreadRowProps) {
  const { selected = false, selectionMode = false, thread } = props;
  const colorScheme = useResolvedMobileColorScheme();
  const colors = useThreadRowColors();

  return (
    <Host
      colorScheme={colorScheme}
      // Edit mode draws a white check on the accent; the dark theme's accent
      // is white, so selection uses the muted gray there.
      seedColor={
        colorScheme === "dark" ? colors.mutedForeground : colors.primary
      }
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
          background(colors.background),
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
  const mailbox = getRowMailbox(props.mailbox ?? "inbox", props.thread);
  const rowProps = { ...props, mailbox } satisfies ThreadRowProps;
  if (props.selectionMode) {
    return <NativeSelectableThread colors={colors} props={rowProps} />;
  }
  if (mailbox === "archive") {
    return <ArchiveSwipeRow colors={colors} props={rowProps} />;
  }
  if (mailbox === "all" && props.thread.canMoveToInbox) {
    return <AllMailSwipeRow colors={colors} props={rowProps} />;
  }
  if (mailbox === "spam" || mailbox === "all") {
    return <NativeThreadButton colors={colors} props={rowProps} />;
  }
  return <InboxSwipeRow colors={colors} props={rowProps} />;
}

function NativeSelectableThread({
  colors,
  props,
}: {
  colors: NativeThreadRowColors;
  props: ThreadRowProps;
}) {
  const { locationTag, mailbox = "inbox", thread } = props;
  return (
    <NativeThreadSummary
      colors={colors}
      mailbox={mailbox}
      locationTag={locationTag}
      modifiers={[
        tag(thread.id),
        accessibilityElement("ignore"),
        accessibilityLabel(getNativeAccessibilityLabel(props)),
        accessibilityHint("Toggles selection"),
        ...rowModifiers(colors.background),
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
  const { locationTag, mailbox = "inbox", onOpen, thread } = props;
  return (
    <Button
      modifiers={[
        buttonStyle("plain"),
        frame({ height: rowHeight, maxWidth: Infinity }),
        accessibilityElement("ignore"),
        accessibilityLabel(getNativeAccessibilityLabel(props)),
        accessibilityHint("Opens this email thread"),
        ...rowModifiers(colors.background),
      ]}
      onPress={onOpen}
    >
      <NativeThreadSummary
        colors={colors}
        mailbox={mailbox}
        locationTag={locationTag}
        thread={thread}
      />
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
    <SwipeActions modifiers={rowModifiers(colors.background)}>
      <NativeThreadButton colors={colors} props={props} />
      <SwipeActions.Actions edge="leading">
        <Button
          label={pinAction.label}
          modifiers={[tint(colors.mutedForeground)]}
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
          modifiers={[tint(colors.mutedForeground)]}
          systemImage="archivebox"
          onPress={() =>
            runAfterSwipeAnimation(() => void archiveThread(props.thread.id))
          }
        />
        <Button
          label={readAction.label}
          modifiers={[tint(colors.mutedForeground)]}
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

function AllMailSwipeRow({
  colors,
  props,
}: {
  colors: NativeThreadRowColors;
  props: ThreadRowProps;
}) {
  return (
    <SwipeActions modifiers={rowModifiers(colors.background)}>
      <NativeThreadButton colors={colors} props={props} />
      <SwipeActions.Actions edge="trailing">
        <Button
          label="Move to Inbox"
          modifiers={[tint(colors.mutedForeground)]}
          systemImage="tray.and.arrow.down"
          onPress={() => runAfterSwipeAnimation(() => props.onMoveToInbox?.())}
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
    <SwipeActions modifiers={rowModifiers(colors.background)}>
      <NativeThreadButton colors={colors} props={props} />
      <SwipeActions.Actions edge="leading">
        <Button
          label="Restore"
          modifiers={[tint(colors.mutedForeground)]}
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

function rowModifiers(background: string) {
  return [
    listRowInsets({ bottom: 0, leading: 0, top: 0, trailing: 0 }),
    listRowSeparator("hidden"),
    listRowBackground(background),
  ];
}

function useThreadRowColors() {
  return {
    background: useColor("background"),
    destructive: useColor("destructive"),
    foreground: useColor("foreground"),
    muted: useColor("muted"),
    mutedForeground: useColor("muted-foreground"),
    primary: useColor("primary"),
  };
}
