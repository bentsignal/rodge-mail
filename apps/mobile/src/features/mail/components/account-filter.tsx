import type { MenuAction } from "@expo/ui/community/menu";
import { Pressable, Text, View } from "react-native";
import { MenuView } from "@expo/ui/community/menu";
import { ChevronDown } from "lucide-react-native";

import type { MailAccount, MailAccountFilter } from "@rodge-mail/features/mail";

import type { MobileMailbox } from "../store";
import { useColor } from "~/hooks/use-color";
import {
  getAccountAddressDetail,
  getMailboxTitle,
  getSelectedAccountLabel,
  MAILBOX_OPTIONS,
} from "../screens/mailbox-scope";
import { useMailStore } from "../store";

const MAILBOX_ACTION_PREFIX = "mailbox:";

/** The search screen's account and mailbox menu, the same choices as the toolbar's. */
export function AccountFilter({
  value,
  accounts,
  mailbox,
}: {
  accounts: MailAccount[];
  mailbox: MobileMailbox;
  value: MailAccountFilter;
}) {
  const mutedForeground = useColor("muted-foreground");
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const setMailbox = useMailStore((store) => store.setMailbox);
  const selectedLabel = [
    getMailboxTitle(mailbox, value),
    getSelectedAccountLabel(value, accounts),
  ]
    .filter(Boolean)
    .join(" · ");
  const mailboxActions = MAILBOX_OPTIONS.map((option) => ({
    id: `${MAILBOX_ACTION_PREFIX}${option.value}`,
    image: option.icon,
    state: selectionState(mailbox === option.value),
    title: option.label,
  }));
  const accountActions = [
    {
      id: "all",
      state: selectionState(value === "all"),
      title: "All Accounts",
    },
    ...accounts.map((account) => ({
      id: account.id,
      state: selectionState(value === account.id),
      subtitle: getAccountAddressDetail(account),
      title: account.label,
    })),
  ];
  const actions = [
    {
      id: "accounts",
      image: "person.crop.circle",
      subactions: accountActions,
      title: "Account",
    },
    {
      id: "mailboxes",
      image: "tray",
      subactions: mailboxActions,
      title: "Mailbox",
    },
  ] satisfies MenuAction[];

  return (
    <View className="min-w-0 flex-1">
      <MenuView
        key={`${mailbox}:${value}`}
        actions={actions}
        style={{ width: "100%" }}
        testID="mailbox-picker"
        onPressAction={(event) => {
          const id = event.nativeEvent.event;
          const option = MAILBOX_OPTIONS.find(
            ({ value: next }) => id === `${MAILBOX_ACTION_PREFIX}${next}`,
          );
          if (option) setMailbox(option.value);
          else setAccountFilter(id);
        }}
      >
        <Pressable
          accessibilityHint="Choose which account and mailbox to show"
          accessibilityLabel={`Mailbox: ${selectedLabel}`}
          accessibilityRole="button"
          className="bg-muted border-border h-11 min-w-0 flex-row items-center gap-2 rounded-xl border px-3"
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
