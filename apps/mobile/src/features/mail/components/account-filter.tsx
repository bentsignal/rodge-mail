import { Pressable, ScrollView, Text } from "react-native";

import type { MailAccount, MailAccountFilter } from "@rodge-mail/features/mail";

export function AccountFilter({
  value,
  accounts,
  onChange,
}: {
  accounts: MailAccount[];
  value: MailAccountFilter;
  onChange: (value: MailAccountFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      contentContainerClassName="gap-2 px-4"
      showsHorizontalScrollIndicator={false}
    >
      <AccountFilterButton
        label="All inboxes"
        selected={value === "all"}
        onPress={() => onChange("all")}
      />
      {accounts.map((account) => (
        <AccountFilterButton
          key={account.id}
          label={account.label}
          selected={value === account.id}
          onPress={() => onChange(account.id)}
        />
      ))}
    </ScrollView>
  );
}

function AccountFilterButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={
        selected
          ? "bg-foreground rounded-full px-4 py-2"
          : "bg-muted rounded-full px-4 py-2"
      }
      onPress={onPress}
    >
      <Text
        className={
          selected
            ? "text-background text-sm font-semibold"
            : "text-foreground text-sm font-semibold"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
