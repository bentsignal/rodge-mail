import type { MenuAction } from "@expo/ui/community/menu";
import { Pressable, Text, View } from "react-native";
import { MenuView } from "@expo/ui/community/menu";
import { ChevronDown } from "lucide-react-native";

import type { MailAccount, MailAccountFilter } from "@rodge-mail/features/mail";

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
  const mutedForeground = useColor("muted-foreground");
  const selectedAccount =
    value === "all"
      ? undefined
      : accounts.find((account) => account.id === value);
  const selectedLabel = selectedAccount
    ? getAccountLabel(selectedAccount)
    : "All Inboxes";
  const actions = [
    { id: "all", state: selectionState(value === "all"), title: "All Inboxes" },
    ...accounts.map((account) => ({
      id: account.id,
      state: selectionState(value === account.id),
      title: getAccountLabel(account),
    })),
  ] satisfies MenuAction[];

  return (
    <View className="min-w-0 flex-1">
      <MenuView
        actions={actions}
        style={{ width: "100%" }}
        testID="mailbox-picker"
        onPressAction={(event) => onChange(event.nativeEvent.event)}
      >
        <Pressable
          accessibilityHint="Choose which inbox to show"
          accessibilityLabel={`Mailbox: ${selectedLabel}`}
          accessibilityRole="button"
          className="bg-paper-deep border-paper-border h-11 min-w-0 flex-row items-center gap-2 rounded-xl border px-3"
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

function selectionState(selected: boolean) {
  return selected ? ("on" as const) : ("off" as const);
}

function getAccountLabel(account: MailAccount) {
  if (account.label === account.address) return account.address;
  return `${account.label} · ${account.address}`;
}
