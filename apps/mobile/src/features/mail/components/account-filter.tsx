import type { MenuAction } from "@expo/ui/community/menu";
import { Pressable, Text, View } from "react-native";
import { MenuView } from "@expo/ui/community/menu";
import { ChevronDown } from "lucide-react-native";

import type { MailAccount, MailAccountFilter } from "@rodge-mail/features/mail";

import type { MobileMailbox, OtherMailbox } from "../store";
import { useColor } from "~/hooks/use-color";

export function AccountFilter({
  value,
  accounts,
  mailbox,
  onChange,
  onMailboxSelect,
}: {
  accounts: MailAccount[];
  mailbox: MobileMailbox;
  value: MailAccountFilter;
  onChange: (value: MailAccountFilter) => void;
  onMailboxSelect: (mailbox: OtherMailbox) => void;
}) {
  const mutedForeground = useColor("muted-foreground");
  const selectedAccount =
    value === "all"
      ? undefined
      : accounts.find((account) => account.id === value);
  const selectedLabel =
    mailbox === "inbox"
      ? selectedAccount
        ? getAccountLabel(selectedAccount)
        : "All Inboxes"
      : MAILBOX_TITLES[mailbox];
  const actions = [
    {
      id: "all",
      image: "tray.full" as const,
      state: selectionState(mailbox === "inbox" && value === "all"),
      title: "All Inboxes",
    },
    ...accounts.map((account) => ({
      id: account.id,
      image: "tray" as const,
      state: selectionState(mailbox === "inbox" && value === account.id),
      title: getAccountLabel(account),
    })),
    {
      id: allMailboxId,
      image: "mail.stack" as const,
      state: selectionState(mailbox === "all"),
      title: "All Mail",
    },
    {
      id: archiveMailboxId,
      image: "archivebox" as const,
      state: selectionState(mailbox === "archive"),
      title: "Archive",
    },
    {
      id: spamMailboxId,
      image: "exclamationmark.shield" as const,
      state: selectionState(mailbox === "spam"),
      title: "Spam",
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
          const nextValue = event.nativeEvent.event;
          if (nextValue === allMailboxId) onMailboxSelect("all");
          else if (nextValue === archiveMailboxId) onMailboxSelect("archive");
          else if (nextValue === spamMailboxId) onMailboxSelect("spam");
          else onChange(nextValue);
        }}
      >
        <Pressable
          accessibilityHint="Choose which inbox to show"
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

const MAILBOX_TITLES = {
  all: "All Mail",
  archive: "Archive",
  spam: "Spam",
} satisfies Record<OtherMailbox, string>;

const allMailboxId = "__all__";
const archiveMailboxId = "__archive__";
const spamMailboxId = "__spam__";

function selectionState(selected: boolean) {
  return selected ? ("on" as const) : ("off" as const);
}

function getAccountLabel(account: MailAccount) {
  if (account.label === account.address) return account.address;
  return `${account.label} · ${account.address}`;
}
