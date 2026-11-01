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
      <SenderPicker
        accounts={accounts}
        selectedAccount={selectedAccount}
        onChange={onChange}
      />
    </ComposerRow>
  );
}

/** The sending address, opening the account menu in one tap when there's a choice. */
export function SenderPicker({
  accounts,
  muted = false,
  onChange,
  selectedAccount,
}: {
  accounts: MobileMailAccount[];
  muted?: boolean;
  onChange: (accountId: string) => void;
  selectedAccount: MobileMailAccount;
}) {
  const mutedForeground = useColor("muted-foreground");

  if (accounts.length < 2) {
    return <SenderAddress address={selectedAccount.address} muted={muted} />;
  }

  return (
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
        <SenderAddress address={selectedAccount.address} muted={muted} />
        <ChevronsUpDown color={mutedForeground} size={14} />
      </Pressable>
    </MenuView>
  );
}

function SenderAddress({
  address,
  muted,
}: {
  address: string;
  muted: boolean;
}) {
  return (
    <Text
      className={`${muted ? "text-muted-foreground" : "text-foreground"} min-w-0 shrink text-base`}
      numberOfLines={1}
    >
      {address}
    </Text>
  );
}
