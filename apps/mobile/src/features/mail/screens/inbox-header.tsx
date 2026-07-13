import type { MenuAction } from "@expo/ui/community/menu";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MenuView } from "@expo/ui/community/menu";
import { Check, ListChecks, ListFilter } from "lucide-react-native";

import type { MailAccountFilter } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { MailboxFilter } from "./mailbox-controls";
import { useColor } from "~/hooks/use-color";
import { AccountFilter } from "../components/account-filter";
import { InboxSyncStatus } from "./inbox-sync-status";
import { getFilterLabel } from "./mailbox-controls";
import { TemporaryIosSearchBar } from "./temporary-ios-search-bar";

export function InboxHeader({
  accountFilter,
  accounts,
  filter,
  includeTopSafeArea = true,
  mailbox,
  onAccountChange,
  onArchiveSelect,
  onFilterChange,
  onToggleSelection,
  refreshError,
  selectionMode,
  temporarySearch,
}: {
  accountFilter: MailAccountFilter;
  accounts: MobileMailAccount[];
  filter: MailboxFilter;
  includeTopSafeArea?: boolean;
  mailbox: "archive" | "inbox";
  onAccountChange: (value: MailAccountFilter) => void;
  onArchiveSelect: () => void;
  onFilterChange: (value: MailboxFilter) => void;
  onToggleSelection: () => void;
  refreshError: string | undefined;
  selectionMode: boolean;
  temporarySearch?: {
    onChange: (value: string) => void;
    value: string;
  };
}) {
  return (
    <SafeAreaView
      className="bg-paper"
      edges={includeTopSafeArea ? ["top"] : []}
    >
      <View className="border-paper-border gap-2 border-b px-4 py-2">
        <TemporarySearchSlot mailbox={mailbox} search={temporarySearch} />
        <View className="min-h-11 flex-row items-center gap-2">
          <AccountFilter
            accounts={accounts}
            mailbox={mailbox}
            value={accountFilter}
            onChange={onAccountChange}
            onArchiveSelect={onArchiveSelect}
          />
          <MailboxFilterMenu filter={filter} onChange={onFilterChange} />
          <SelectionButton
            selectionMode={selectionMode}
            onPress={onToggleSelection}
          />
        </View>
        <InboxSyncStatus accounts={accounts} error={refreshError} />
      </View>
    </SafeAreaView>
  );
}

function SelectionButton({
  onPress,
  selectionMode,
}: {
  onPress: () => void;
  selectionMode: boolean;
}) {
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");

  return (
    <Pressable
      accessibilityLabel={selectionMode ? "Done selecting" : "Select messages"}
      accessibilityRole="button"
      className="bg-paper-deep border-paper-border size-11 items-center justify-center rounded-xl border"
      testID="mailbox-select-button"
      onPress={onPress}
    >
      <SelectionButtonIcon
        color={selectionMode ? primary : mutedForeground}
        selectionMode={selectionMode}
      />
    </Pressable>
  );
}

function SelectionButtonIcon({
  color,
  selectionMode,
}: {
  color: string;
  selectionMode: boolean;
}) {
  if (selectionMode) return <Check color={color} size={19} strokeWidth={2.5} />;
  return <ListChecks color={color} size={18} />;
}

function MailboxFilterMenu({
  filter,
  onChange,
}: {
  filter: MailboxFilter;
  onChange: (value: MailboxFilter) => void;
}) {
  const mutedForeground = useColor("muted-foreground");
  const actions = [
    filterAction("all", "All", filter),
    filterAction("unread", "Unread", filter),
  ] satisfies MenuAction[];

  return (
    <MenuView
      key={filter}
      actions={actions}
      testID="mailbox-filter-button"
      onPressAction={(event) => onChange(parseFilter(event.nativeEvent.event))}
    >
      <Pressable
        accessibilityLabel={`Filter: ${getFilterLabel(filter)}`}
        accessibilityRole="button"
        className="bg-paper-deep border-paper-border size-11 items-center justify-center rounded-xl border"
      >
        <ListFilter color={mutedForeground} size={17} />
        <ActiveFilterDot filter={filter} />
      </Pressable>
    </MenuView>
  );
}

function TemporarySearchSlot({
  mailbox,
  search,
}: {
  mailbox: "archive" | "inbox";
  search: React.ComponentProps<typeof TemporaryIosSearchBar> | undefined;
}) {
  if (!search) return null;
  return (
    <TemporaryIosSearchBar
      key={mailbox}
      {...search}
      placeholder={mailbox === "archive" ? "Search archive" : undefined}
    />
  );
}

function ActiveFilterDot({ filter }: { filter: MailboxFilter }) {
  if (filter !== "unread") return null;
  return (
    <View className="bg-primary absolute top-2 right-2 size-1.5 rounded-full" />
  );
}

function parseFilter(value: string) {
  if (value === "unread") return value;
  return "all";
}

function filterAction(id: MailboxFilter, title: string, filter: MailboxFilter) {
  return {
    id,
    state: id === filter ? ("on" as const) : ("off" as const),
    title,
  };
}
