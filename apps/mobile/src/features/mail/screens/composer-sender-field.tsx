import { Pressable, ScrollView, Text, View } from "react-native";

import type { MobileMailAccount } from "../lib/convex-mail";

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
  if (accounts.length === 0) {
    return (
      <View className="border-border flex-row items-center gap-3 border-b py-2">
        <Text className="text-muted-foreground w-16 text-base">From</Text>
        <View className="min-w-0 flex-1 gap-1 py-1">
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
  return (
    <View className="border-border flex-row items-center gap-3 border-b py-2">
      <Text className="text-muted-foreground w-16 text-base">From</Text>
      <ScrollView
        horizontal
        contentContainerClassName="gap-2 py-1"
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {accounts.map((account) => (
          <SenderButton
            key={account.id}
            account={account}
            onPress={() => onChange(account.id)}
            selected={account.id === selectedAccountId}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function SenderButton({
  account,
  onPress,
  selected,
}: {
  account: MobileMailAccount;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={`Send from ${account.address}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={
        selected
          ? "bg-forest border-forest-raised min-h-11 justify-center rounded-lg border px-3 py-2"
          : "bg-well border-well-border min-h-11 justify-center rounded-lg border px-3 py-2"
      }
      onPress={onPress}
    >
      <Text
        className={
          selected
            ? "text-accent-foreground text-sm font-semibold"
            : "text-foreground text-sm font-semibold"
        }
        numberOfLines={1}
      >
        {account.address}
      </Text>
    </Pressable>
  );
}
