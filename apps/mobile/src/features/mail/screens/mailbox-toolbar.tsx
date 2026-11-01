import { Platform } from "react-native";
import { Stack } from "expo-router";

import type { MailAccountFilter } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { MobileMailbox } from "../store";
import type { MailboxFilter } from "./mailbox-controls";
import type { MailboxBulkAction } from "./mailbox-thread-list";
import { useColor } from "~/hooks/use-color";
import mailboxesIcon from "../../../../assets/toolbar/mailboxes.png";
import { useMailStore } from "../store";
import {
  getAccountAddressDetail,
  getMailboxTitle,
  MAILBOX_OPTIONS,
} from "./mailbox-scope";

export interface MailboxToolbarProps {
  accountFilter: MailAccountFilter;
  accounts: MobileMailAccount[];
  bulkActions: MailboxBulkAction[];
  filter: MailboxFilter;
  filterEnabled?: boolean;
  mailbox: MobileMailbox;
  onFilterChange: (value: MailboxFilter) => void;
  onToggleSelection: () => void;
  selectedCount: number;
  selectionEnabled: boolean;
  selectionMode: boolean;
}

/**
 * The mailbox's native navigation bar, like Mail's: the mailbox as a large
 * title, a menu of accounts and mailboxes, a filter menu, and Select.
 * Selecting shows the bulk actions in the native bottom toolbar.
 */
export function MailboxToolbar(props: MailboxToolbarProps) {
  const { filterEnabled = true, selectionMode } = props;
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const setMailbox = useMailStore((store) => store.setMailbox);
  const selectLabel = selectionMode ? "Done" : "Select";
  return (
    <>
      <Stack.Screen
        options={{
          headerLargeTitle: true,
          headerShown: true,
          title: selectionMode
            ? getSelectionTitle(props.selectedCount)
            : getMailboxTitle(props.mailbox, props.accountFilter),
        }}
      />
      <Stack.Toolbar placement="left">
        {scopeMenu(props, setAccountFilter, setMailbox)}
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          accessibilityLabel="Filter"
          hidden={selectionMode || !filterEnabled}
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
            All Messages
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

// Android drops a toolbar menu whose icon isn't an image.
const SCOPE_MENU_ICON = Platform.OS === "android" ? mailboxesIcon : "tray.2";

// Called, not rendered: toolbar items must be the toolbar's direct children.
function scopeMenu(
  { accountFilter, accounts, mailbox, selectionMode }: MailboxToolbarProps,
  onAccountChange: (value: MailAccountFilter) => void,
  onMailboxChange: (value: MobileMailbox) => void,
) {
  return (
    <Stack.Toolbar.Menu
      accessibilityLabel="Mailboxes"
      hidden={selectionMode}
      icon={SCOPE_MENU_ICON}
    >
      {accountSubmenu(accountFilter, accounts, onAccountChange)}
      <Stack.Toolbar.Menu
        icon="tray"
        inline={accounts.length < 2}
        title="Mailbox"
      >
        {MAILBOX_OPTIONS.map((option) => (
          <Stack.Toolbar.MenuAction
            key={`${option.value}:${mailbox === option.value}`}
            icon={option.icon}
            isOn={mailbox === option.value}
            onPress={() => onMailboxChange(option.value)}
          >
            {option.label}
          </Stack.Toolbar.MenuAction>
        ))}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar.Menu>
  );
}

function accountSubmenu(
  accountFilter: MailAccountFilter,
  accounts: MobileMailAccount[],
  onChange: (value: MailAccountFilter) => void,
) {
  if (accounts.length < 2) return null;
  return (
    <Stack.Toolbar.Menu icon="person.crop.circle" title="Account">
      <Stack.Toolbar.MenuAction
        key={`all:${accountFilter === "all"}`}
        isOn={accountFilter === "all"}
        onPress={() => onChange("all")}
      >
        All Accounts
      </Stack.Toolbar.MenuAction>
      {accounts.map((account) => (
        <Stack.Toolbar.MenuAction
          key={`${account.id}:${accountFilter === account.id}`}
          isOn={accountFilter === account.id}
          subtitle={getAccountAddressDetail(account)}
          onPress={() => onChange(account.id)}
        >
          {account.label}
        </Stack.Toolbar.MenuAction>
      ))}
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
