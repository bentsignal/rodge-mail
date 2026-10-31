import { Pressable, Text } from "react-native";
import { MenuView } from "@expo/ui/community/menu";
import { ChevronsUpDown } from "lucide-react-native";

import type { MobileMailAccount } from "../lib/convex-mail";
import { useColor } from "~/hooks/use-color";
import { ComposerRow } from "./composer-field";
import { getComposerAccountLabel } from "./composer-presentation";

export function ComposerSenderField({
  accounts,
  onChange,
  onOpenSettings,
  selectedAccount,
}: {
  accounts: MobileMailAccount[];
  onChange: (accountId: string) => void;
  onOpenSettings: () => void;
  selectedAccount: MobileMailAccount | undefined;
}) {
  const mutedForeground = useColor("muted-foreground");

  if (!selectedAccount) {
    return (
      <ComposerRow label="From:">
        <Pressable
          accessibilityLabel="Open Settings to connect a sending account"
          accessibilityRole="button"
          className="min-h-8 justify-center"
          onPress={onOpenSettings}
        >
          <Text className="text-foreground text-base underline">
            Connect an account
          </Text>
        </Pressable>
      </ComposerRow>
    );
  }

  return (
    <ComposerRow label="From:">
      <MenuView
        key={selectedAccount.id}
        actions={accounts.map((account) => ({
          id: account.id,
          state:
            account.id === selectedAccount.id
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
          accessibilityLabel={`From ${selectedAccount.address}`}
          accessibilityRole="button"
          className="min-h-8 min-w-0 flex-1 flex-row items-center gap-1"
        >
          <Text
            className="text-foreground min-w-0 shrink text-base"
            numberOfLines={1}
          >
            {selectedAccount.address}
          </Text>
          <ChevronsUpDown color={mutedForeground} size={14} />
        </Pressable>
      </MenuView>
    </ComposerRow>
  );
}
