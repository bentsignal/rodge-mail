import type { MailAccountFilter } from "@rodge-mail/features/mail";

import type { MobileMailbox } from "../store";

export const MAILBOX_OPTIONS = [
  { icon: "tray", label: "Inbox", value: "inbox" },
  { icon: "mail.stack", label: "All Mail", value: "all" },
  { icon: "paperplane", label: "Sent", value: "sent" },
  { icon: "archivebox", label: "Archive", value: "archive" },
  { icon: "xmark.bin", label: "Spam", value: "spam" },
] as const satisfies readonly {
  icon: string;
  label: string;
  value: MobileMailbox;
}[];

export function getMailboxTitle(
  mailbox: MobileMailbox,
  accountFilter: MailAccountFilter,
) {
  if (mailbox === "inbox" && accountFilter === "all") return "All Inboxes";
  return (
    MAILBOX_OPTIONS.find((option) => option.value === mailbox)?.label ?? "Inbox"
  );
}

/** The selected account's name, or nothing when every account is showing. */
export function getSelectedAccountLabel(
  accountFilter: MailAccountFilter,
  accounts: readonly { id: string; label: string }[],
) {
  return accounts.find((account) => account.id === accountFilter)?.label;
}

/** The address under an account's name, unless the name already is it. */
export function getAccountAddressDetail(account: {
  address: string;
  label: string;
}) {
  return account.label === account.address ? undefined : account.address;
}
