import type { MenuAction } from "@expo/ui/community/menu";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Host } from "@expo/ui";
import { MenuView } from "@expo/ui/community/menu";
import { ListFilter } from "lucide-react-native";

import type { MailAccountFilter } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { MailboxFilter } from "./mailbox-controls";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import { AccountFilter } from "../components/account-filter";
import { InboxSyncStatus } from "./inbox-sync-status";
import { getFilterLabel } from "./mailbox-controls";

export function InboxHeader({
  accountFilter,
  accounts,
  filter,
  includeTopSafeArea = true,
  onAccountChange,
  onFilterChange,
  onToggleSelection,
  refreshError,
  selectionMode,
}: {
  accountFilter: MailAccountFilter;
  accounts: MobileMailAccount[];
  filter: MailboxFilter;
  includeTopSafeArea?: boolean;
  onAccountChange: (value: MailAccountFilter) => void;
  onFilterChange: (value: MailboxFilter) => void;
  onToggleSelection: () => void;
  refreshError: string | undefined;
  selectionMode: boolean;
}) {
  const colorScheme = useResolvedMobileColorScheme();
  const primary = useColor("primary");

  return (
    <SafeAreaView
      className="bg-paper"
      edges={includeTopSafeArea ? ["top"] : []}
    >
      <View className="border-paper-border border-b px-3 py-2">
        <View className="min-h-11 flex-row items-center gap-2">
          <AccountFilter
            accounts={accounts}
            value={accountFilter}
            onChange={onAccountChange}
          />
          <MailboxFilterMenu filter={filter} onChange={onFilterChange} />
          <Host
            colorScheme={colorScheme}
            matchContents
            seedColor={primary}
            style={{ height: 44, width: 68 }}
          >
            <Button
              label={selectionMode ? "Done" : "Select"}
              style={{ height: 44, width: 68 }}
              testID="mailbox-select-button"
              variant="text"
              onPress={onToggleSelection}
            />
          </Host>
        </View>
        <InboxSyncStatus accounts={accounts} error={refreshError} />
      </View>
    </SafeAreaView>
  );
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
    filterAction("read", "Read", filter),
  ] satisfies MenuAction[];

  return (
    <MenuView
      actions={actions}
      testID="mailbox-filter-button"
      onPressAction={(event) => onChange(parseFilter(event.nativeEvent.event))}
    >
      <Pressable
        accessibilityLabel={`Filter: ${filter === "all" ? "All" : getFilterLabel(filter)}`}
        accessibilityRole="button"
        className="bg-paper-deep border-paper-border h-11 flex-row items-center gap-1.5 rounded-xl border px-2.5"
      >
        <ListFilter color={mutedForeground} size={15} />
        <Text className="text-foreground text-sm font-semibold">
          {getFilterLabel(filter)}
        </Text>
      </Pressable>
    </MenuView>
  );
}

function parseFilter(value: string) {
  if (value === "read" || value === "unread") return value;
  return "all";
}

function filterAction(id: MailboxFilter, title: string, filter: MailboxFilter) {
  return {
    id,
    state: id === filter ? ("on" as const) : ("off" as const),
    title,
  };
}
