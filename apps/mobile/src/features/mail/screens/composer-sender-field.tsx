import { Pressable, Text, View } from "react-native";
import { MenuView } from "@expo/ui/community/menu";
import { ChevronDown } from "lucide-react-native";

import type { MobileMailAccount } from "../lib/convex-mail";
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
  const mutedForeground = useColor("muted-foreground");
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
  const selectedLabel = selectedAccount
    ? getComposerAccountLabel(selectedAccount)
    : "Choose an account";

  return (
    <View className="min-h-16 flex-row items-center gap-3 py-2">
      <Text className="text-muted-foreground w-14 text-sm font-medium">
        From
      </Text>
      <MenuView
        key={selectedAccountId}
        actions={accounts.map((account) => ({
          id: account.id,
          state:
            account.id === selectedAccountId
              ? ("on" as const)
              : ("off" as const),
          title: getComposerAccountLabel(account),
        }))}
        style={{ flex: 1 }}
        testID="composer-sender-picker"
        onPressAction={(event) => onChange(event.nativeEvent.event)}
      >
        <Pressable
          accessibilityHint="Choose the account that sends this message"
          accessibilityLabel={`From ${selectedLabel}`}
          accessibilityRole="button"
          className="h-12 min-w-0 flex-1 flex-row items-center gap-2 px-1"
        >
          <Text
            className="text-foreground min-w-0 flex-1 text-sm font-semibold"
            numberOfLines={1}
          >
            {selectedLabel}
          </Text>
          <ChevronDown color={mutedForeground} size={16} />
        </Pressable>
      </MenuView>
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
