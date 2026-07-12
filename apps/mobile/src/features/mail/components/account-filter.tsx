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
      className="min-w-0 flex-1"
      horizontal
      contentContainerClassName="gap-2 pl-4"
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
          label={getAccountLabel(account)}
          selected={value === account.id}
          onPress={() => onChange(account.id)}
        />
      ))}
    </ScrollView>
  );
}

function getAccountLabel(account: MailAccount) {
  if (account.label === account.address) return account.address;
  return `${account.label} · ${account.address}`;
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
          ? "bg-forest border-forest-raised min-h-11 justify-center rounded-lg border px-4 py-2"
          : "bg-paper border-paper-border min-h-11 justify-center rounded-lg border px-4 py-2"
      }
      onPress={onPress}
    >
      <Text
        className={
          selected
            ? "text-accent-foreground text-sm font-semibold"
            : "text-foreground text-sm font-semibold"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
