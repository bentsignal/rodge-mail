import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Host, Switch } from "@expo/ui";

import type { MailAccountFilter } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import { AccountFilter } from "../components/account-filter";
import { InboxSyncStatus } from "./inbox-sync-status";

export function InboxHeader({
  accountFilter,
  accounts,
  onAccountChange,
  refreshError,
  showUnreadOnly,
  onUnreadChange,
}: {
  accountFilter: MailAccountFilter;
  accounts: MobileMailAccount[];
  onAccountChange: (value: MailAccountFilter) => void;
  refreshError: string | undefined;
  showUnreadOnly: boolean;
  onUnreadChange: (value: boolean) => void;
}) {
  const colorScheme = useResolvedMobileColorScheme();
  const primary = useColor("primary");

  return (
    <SafeAreaView className="bg-paper" edges={["top"]}>
      <View className="border-paper-border border-b px-3 py-2">
        <View className="min-h-11 flex-row items-center gap-3">
          <AccountFilter
            accounts={accounts}
            value={accountFilter}
            onChange={onAccountChange}
          />
          <Host
            colorScheme={colorScheme}
            matchContents={{ vertical: true }}
            seedColor={primary}
            style={{ width: 132 }}
          >
            <Switch
              label="Unread"
              testID="unread-only-switch"
              value={showUnreadOnly}
              onValueChange={onUnreadChange}
            />
          </Host>
        </View>
        <InboxSyncStatus accounts={accounts} error={refreshError} />
      </View>
    </SafeAreaView>
  );
}
