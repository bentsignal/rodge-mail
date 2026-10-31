import { Stack } from "expo-router";

import type { MailAccountFilter } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { MobileMailbox } from "../store";
import type { MailboxFilter } from "./mailbox-controls";
import type { MailboxBulkAction } from "./mailbox-thread-list";
import { useColor } from "~/hooks/use-color";

export interface MailboxToolbarProps {
  accountFilter: MailAccountFilter;
  accounts: MobileMailAccount[];
  bulkActions: MailboxBulkAction[];
  filter: MailboxFilter;
  mailbox: MobileMailbox;
  onAccountChange: (value: MailAccountFilter) => void;
  onArchiveSelect: () => void;
  onFilterChange: (value: MailboxFilter) => void;
  onSpamSelect: () => void;
  onToggleSelection: () => void;
  selectedCount: number;
  selectionEnabled: boolean;
  selectionMode: boolean;
}

/**
 * The mailbox's native navigation bar, like Mail's: the mailbox as a large
 * title, a mailbox menu, a filter menu, and Select. Selecting shows the
 * bulk actions in the native bottom toolbar.
 */
export function MailboxToolbar(props: MailboxToolbarProps) {
  const { selectionMode } = props;
  const selectLabel = selectionMode ? "Done" : "Select";
  return (
    <>
      <Stack.Screen
        options={{
          headerLargeTitle: true,
          headerShown: true,
          title: selectionMode
            ? getSelectionTitle(props.selectedCount)
            : getMailboxTitle(props),
        }}
      />
      <Stack.Toolbar placement="left">{mailboxMenu(props)}</Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          accessibilityLabel="Filter"
          hidden={selectionMode}
          icon={
            props.filter === "unread"
              ? "line.3.horizontal.decrease.circle.fill"
              : "line.3.horizontal.decrease.circle"
          }
        >
          <Stack.Toolbar.MenuAction
            key={`all:${props.filter}`}
            isOn={props.filter === "all"}
            onPress={() => props.onFilterChange("all")}
          >
            All Mail
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            key={`unread:${props.filter}`}
            icon="envelope.badge"
            isOn={props.filter === "unread"}
            onPress={() => props.onFilterChange("unread")}
          >
            Unread
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          hidden={!props.selectionEnabled}
          variant={selectionMode ? "done" : "plain"}
          onPress={props.onToggleSelection}
        >
          {selectLabel}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <SelectionToolbar
        actions={props.bulkActions}
        selectedCount={props.selectedCount}
        selectionMode={selectionMode}
      />
    </>
  );
}

// Called, not rendered: toolbar items must be the toolbar's direct children.
function mailboxMenu({
  accountFilter,
  accounts,
  mailbox,
  onAccountChange,
  onArchiveSelect,
  onSpamSelect,
  selectionMode,
}: MailboxToolbarProps) {
  const isInbox = mailbox === "inbox";
  return (
    <Stack.Toolbar.Menu
      accessibilityLabel="Mailboxes"
      hidden={selectionMode}
      icon="tray.2"
    >
      <Stack.Toolbar.MenuAction
        key={`all:${isInbox && accountFilter === "all"}`}
        icon="tray.full"
        isOn={isInbox && accountFilter === "all"}
        onPress={() => onAccountChange("all")}
      >
        All Inboxes
      </Stack.Toolbar.MenuAction>
      {accounts.map((account) => (
        <Stack.Toolbar.MenuAction
          key={`${account.id}:${isInbox && accountFilter === account.id}`}
          icon="tray"
          isOn={isInbox && accountFilter === account.id}
          onPress={() => onAccountChange(account.id)}
        >
          {account.label}
        </Stack.Toolbar.MenuAction>
      ))}
      <Stack.Toolbar.MenuAction
        key={`archive:${mailbox === "archive"}`}
        icon="archivebox"
        isOn={mailbox === "archive"}
        onPress={onArchiveSelect}
      >
        Archive
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        key={`spam:${mailbox === "spam"}`}
        icon="xmark.bin"
        isOn={mailbox === "spam"}
        onPress={onSpamSelect}
      >
        Spam
      </Stack.Toolbar.MenuAction>
    </Stack.Toolbar.Menu>
  );
}

export function SelectionToolbar({
  actions,
  selectedCount,
  selectionMode,
}: {
  actions: MailboxBulkAction[];
  selectedCount: number;
  selectionMode: boolean;
}) {
  const destructive = useColor("destructive");
  if (!selectionMode || actions.length === 0) return null;
  return (
    <Stack.Toolbar>
      {actions.flatMap((action, index) => [
        <Stack.Toolbar.Spacer key={`spacer-${action.label}`} />,
        <Stack.Toolbar.Button
          key={action.label}
          accessibilityLabel={action.label}
          disabled={selectedCount === 0}
          icon={action.systemImage}
          tintColor={action.destructive ? destructive : undefined}
          onPress={action.onPress}
        />,
        ...(index === actions.length - 1
          ? [<Stack.Toolbar.Spacer key="spacer-end" />]
          : []),
      ])}
    </Stack.Toolbar>
  );
}

function getSelectionTitle(count: number) {
  if (count === 0) return "Select Messages";
  return `${count} Selected`;
}

function getMailboxTitle({
  accountFilter,
  accounts,
  mailbox,
}: MailboxToolbarProps) {
  if (mailbox === "archive") return "Archive";
  if (mailbox === "spam") return "Spam";
  if (accountFilter === "all") return "All Inboxes";
  return (
    accounts.find((account) => account.id === accountFilter)?.label ?? "Inbox"
  );
}
