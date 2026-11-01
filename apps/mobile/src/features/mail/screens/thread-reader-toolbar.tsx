import { Stack } from "expo-router";

import type { MobileMailbox } from "../store";
import { useColor } from "~/hooks/use-color";

export interface CleanViewMenuAction {
  disabled: boolean;
  label: string;
  onPress: () => void;
}

export function ThreadReaderToolbar({
  canMoveToInbox,
  cleanViewAction,
  isPinned,
  mailbox,
  onArchive,
  onDelete,
  onMoveToInbox,
  onPin,
  onReply,
  onRestore,
  onUnsubscribe,
  title,
  unsubscribeName,
}: {
  canMoveToInbox: boolean;
  cleanViewAction?: CleanViewMenuAction;
  isPinned: boolean;
  mailbox: MobileMailbox;
  onArchive: () => void;
  onDelete: () => void;
  onMoveToInbox: () => void;
  onPin: () => void;
  onReply: () => void;
  onRestore: () => void;
  onUnsubscribe: () => void;
  title: string;
  unsubscribeName?: string;
}) {
  const destructive = useColor("destructive");
  const isInbox = mailbox === "inbox";
  const isArchive = mailbox === "archive";
  const pinLabel = isPinned ? "Unpin" : "Pin";
  return (
    <>
      <Stack.Screen options={{ title }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu accessibilityLabel="More" icon="ellipsis">
          <Stack.Toolbar.MenuAction
            disabled={cleanViewAction?.disabled}
            hidden={!cleanViewAction}
            icon="sparkles"
            onPress={() => cleanViewAction?.onPress()}
          >
            {cleanViewAction?.label ?? ""}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            hidden={!isInbox}
            icon={isPinned ? "pin.slash" : "pin"}
            onPress={onPin}
          >
            {pinLabel}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            hidden={!isInbox || !unsubscribeName}
            icon="envelope.badge.shield.half.filled"
            onPress={onUnsubscribe}
          >
            {`Unsubscribe from ${unsubscribeName ?? ""}`}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          accessibilityLabel="Archive"
          hidden={!isInbox}
          icon="archivebox"
          onPress={onArchive}
        />
        <Stack.Toolbar.Button
          accessibilityLabel="Move to Inbox"
          hidden={mailbox !== "all" || !canMoveToInbox}
          icon="tray.and.arrow.down"
          onPress={onMoveToInbox}
        />
        <Stack.Toolbar.Button
          accessibilityLabel="Restore"
          hidden={!isArchive}
          icon="arrow.uturn.backward"
          onPress={onRestore}
        />
        <Stack.Toolbar.Button
          accessibilityLabel="Delete"
          hidden={!isArchive}
          icon="trash"
          tintColor={destructive}
          onPress={onDelete}
        />
        <Stack.Toolbar.Button
          accessibilityLabel="Reply"
          hidden={isArchive}
          icon="arrowshape.turn.up.left"
          onPress={onReply}
        />
      </Stack.Toolbar>
    </>
  );
}
