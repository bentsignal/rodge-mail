import { View } from "react-native";
import { Host, Picker } from "@expo/ui";

import type { MailAccount, MailAccountFilter } from "@rodge-mail/features/mail";

import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";

export function AccountFilter({
  value,
  accounts,
  onChange,
}: {
  accounts: MailAccount[];
  value: MailAccountFilter;
  onChange: (value: MailAccountFilter) => void;
}) {
  const colorScheme = useResolvedMobileColorScheme();
  const primary = useColor("primary");

  return (
    <View className="min-w-0 flex-1">
      <Host
        colorScheme={colorScheme}
        matchContents={{ vertical: true }}
        seedColor={primary}
        style={{ width: "100%" }}
      >
        <Picker
          appearance="menu"
          selectedValue={value}
          testID="mailbox-picker"
          onValueChange={onChange}
        >
          <Picker.Item label="All inboxes" value="all" />
          {accounts.map((account) => (
            <Picker.Item
              key={account.id}
              label={getAccountLabel(account)}
              value={account.id}
            />
          ))}
        </Picker>
      </Host>
    </View>
  );
}

function getAccountLabel(account: MailAccount) {
  if (account.label === account.address) return account.address;
  return `${account.label} · ${account.address}`;
}
