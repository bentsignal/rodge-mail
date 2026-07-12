import { Pressable, Text, View } from "react-native";
import { Host, Picker } from "@expo/ui";

import type { MobileMailAccount } from "../lib/convex-mail";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import { getComposerAccountLabel } from "./composer-presentation";

export function ComposerSenderField({
  accounts,
  onChange,
  onOpenSettings,
  selectedAccountId,
}: {
  accounts: MobileMailAccount[];
  onChange: (accountId: string) => void;
  onOpenSettings: () => void;
  selectedAccountId: string | undefined;
}) {
  const firstAccount = accounts[0];

  if (!firstAccount) {
    return <MissingSender onOpenSettings={onOpenSettings} />;
  }

  return (
    <SenderPicker
      accounts={accounts}
      selectedAccountId={selectedAccountId ?? firstAccount.id}
      onChange={onChange}
    />
  );
}

function SenderPicker({
  accounts,
  onChange,
  selectedAccountId,
}: {
  accounts: MobileMailAccount[];
  onChange: (accountId: string) => void;
  selectedAccountId: string;
}) {
  const colorScheme = useResolvedMobileColorScheme();
  const primary = useColor("primary");

  return (
    <View className="border-border min-h-14 flex-row items-center gap-3 border-b py-1">
      <Text className="text-muted-foreground w-14 text-sm font-medium">
        From
      </Text>
      <Host
        colorScheme={colorScheme}
        matchContents={{ vertical: true }}
        seedColor={primary}
        style={{ flex: 1 }}
      >
        <Picker
          appearance="menu"
          selectedValue={selectedAccountId}
          testID="composer-sender-picker"
          onValueChange={onChange}
        >
          {accounts.map((account) => (
            <Picker.Item
              key={account.id}
              label={getComposerAccountLabel(account)}
              value={account.id}
            />
          ))}
        </Picker>
      </Host>
    </View>
  );
}

function MissingSender({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <View className="border-border min-h-16 flex-row items-center gap-3 border-b py-2">
      <Text className="text-muted-foreground w-14 text-sm font-medium">
        From
      </Text>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-foreground text-sm font-medium">
          Connect an account to send mail.
        </Text>
        <Pressable
          accessibilityLabel="Open Settings to connect a sending account"
          accessibilityRole="button"
          className="min-h-8 justify-center self-start"
          hitSlop={8}
          onPress={onOpenSettings}
        >
          <Text className="text-primary text-sm font-semibold">
            Open Settings
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
