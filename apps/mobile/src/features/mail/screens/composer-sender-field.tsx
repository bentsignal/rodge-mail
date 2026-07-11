import { Pressable, ScrollView, Text, View } from "react-native";

import type { MobileMailAccount } from "../lib/convex-mail";

export function ComposerSenderField({
  accounts,
  onChange,
  selectedAccountId,
}: {
  accounts: MobileMailAccount[];
  onChange: (accountId: string) => void;
  selectedAccountId: string | undefined;
}) {
  if (accounts.length === 0) return null;
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
