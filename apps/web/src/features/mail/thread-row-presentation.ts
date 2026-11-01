import { getMailLocationTag } from "@rodge-mail/features/mail";

import type { MailMode } from "./live-data-types";
import type { MailAccountFilter } from "./store";
import type { InboxMessage, MailAccountView } from "./types";

export function getThreadRowAccessibilityLabel({
  isRead,
  senderName,
  subject,
}: {
  isRead: boolean;
  senderName: string;
  subject: string;
}) {
  return `${senderName}, ${subject}, ${isRead ? "read" : "unread"}`;
}

export function isThreadUnread(isRead: boolean) {
  return !isRead;
}

export function getThreadRowTag({
  accountFilter,
  accounts,
  isSearch,
  mailMode,
  message,
}: {
  accountFilter: MailAccountFilter;
  accounts: MailAccountView[];
  isSearch: boolean;
  mailMode: MailMode;
  message: InboxMessage;
}) {
  if (mailMode !== "inbox" && mailMode !== "all") return undefined;
  const isElsewhere = message.location.kind !== "inbox";
  return getMailLocationTag({
    accountLabel: accounts.find((account) => account._id === message.accountId)
      ?.label,
    location: message.location,
    showAccount:
      isSearch ||
      (isElsewhere && accountFilter === "all" && accounts.length > 1),
  });
}
