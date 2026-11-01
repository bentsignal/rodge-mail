import { Text } from "react-native";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { MailboxBulkAction } from "./mailbox-thread-list";
import { InboxHeader } from "./inbox-header";
import { InboxSyncStatus } from "./inbox-sync-status";
import { getSelectedAccountLabel } from "./mailbox-scope";
import { MailboxToolbar, SelectionToolbar } from "./mailbox-toolbar";

export function ListHeader({
  accounts,
  headerInList,
  headerProps,
  refreshError,
  searchMode,
}: {
  accounts: MobileMailAccount[];
  headerInList: boolean;
  headerProps: React.ComponentProps<typeof InboxHeader>;
  refreshError: string | undefined;
  searchMode: boolean;
}) {
  if (headerInList) return <InboxHeader {...headerProps} />;
  if (searchMode) return null;
  return (
    <>
      <SelectedAccountLabel
        accountFilter={headerProps.accountFilter}
        accounts={accounts}
      />
      <InboxSyncStatus accounts={accounts} error={refreshError} />
    </>
  );
}

/** Which account the large title above it is for. */
export function SelectedAccountLabel({
  accountFilter,
  accounts,
}: {
  accountFilter: string;
  accounts: MobileMailAccount[];
}) {
  const label = getSelectedAccountLabel(accountFilter, accounts);
  if (!label) return null;
  return (
    <Text
      className="text-muted-foreground px-4 pb-2 text-[15px]"
      numberOfLines={1}
      testID="mailbox-selected-account"
    >
      {label}
    </Text>
  );
}

export function MailboxHeaderSlot({
  bulkActions,
  headerInList,
  searchMode,
  selectedCount,
  ...props
}: React.ComponentProps<typeof InboxHeader> & {
  bulkActions: MailboxBulkAction[];
  headerInList: boolean;
  searchMode: boolean;
  selectedCount: number;
}) {
  if (!searchMode) {
    return (
      <MailboxToolbar
        {...props}
        bulkActions={bulkActions}
        selectedCount={selectedCount}
        selectionEnabled={props.selectionEnabled ?? true}
      />
    );
  }
  return (
    <>
      <SelectionToolbar
        actions={bulkActions}
        selectedCount={selectedCount}
        selectionMode={props.selectionMode}
      />
      <SearchModeHeader headerInList={headerInList} {...props} />
    </>
  );
}

function SearchModeHeader({
  headerInList,
  ...props
}: React.ComponentProps<typeof InboxHeader> & { headerInList: boolean }) {
  if (headerInList) return null;
  return <InboxHeader {...props} />;
}
