import type { MailAccount, MailThread } from "@rodge-mail/features/mail";
import { getMailLocationTag } from "@rodge-mail/features/mail";

import type { MobileMailbox } from "../store";

export function getSenderInitials(sender: string) {
  return sender
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

export function getThreadRowAccessibilityLabel(
  thread: Pick<MailThread, "isPinned" | "isRead" | "sender" | "subject">,
) {
  const state = [
    thread.isRead ? "read" : "unread",
    thread.isPinned ? "pinned" : undefined,
  ].filter(Boolean);

  return `${thread.sender.name}, ${thread.subject}, ${state.join(", ")}`;
}

export function getPinAction(thread: Pick<MailThread, "isPinned">) {
  return thread.isPinned
    ? { label: "Unpin", systemImage: "pin.slash" as const }
    : { label: "Pin", systemImage: "pin" as const };
}

export function getReadAction(thread: Pick<MailThread, "isRead">) {
  return thread.isRead
    ? { label: "Mark Unread", systemImage: "envelope.badge" as const }
    : { label: "Mark Read", systemImage: "envelope.open" as const };
}

export function isThreadUnread(thread: Pick<MailThread, "isRead">) {
  return !thread.isRead;
}

export function getThreadRowNativeKey(
  thread: Pick<MailThread, "id" | "isPinned" | "isRead">,
) {
  return `${thread.id}:${thread.isPinned ? "pinned" : "unpinned"}:${thread.isRead ? "read" : "unread"}`;
}

/** A search hit filed outside the inbox gets All Mail's actions, not Archive. */
export function getRowMailbox(
  mailbox: MobileMailbox,
  thread: Pick<MailThread, "location">,
) {
  if (mailbox !== "inbox") return mailbox;
  const kind = thread.location?.kind ?? "inbox";
  return kind === "inbox" ? "inbox" : "all";
}

export function getThreadTag({
  accountFilter,
  accounts,
  isSearch,
  thread,
}: {
  accountFilter: string;
  accounts: MailAccount[];
  isSearch: boolean;
  thread: Pick<MailThread, "accountId" | "location">;
}) {
  const isElsewhere = (thread.location?.kind ?? "inbox") !== "inbox";
  return getMailLocationTag({
    accountLabel: accounts.find((account) => account.id === thread.accountId)
      ?.label,
    location: thread.location,
    showAccount:
      isSearch ||
      (isElsewhere && accountFilter === "all" && accounts.length > 1),
  });
}

export function runAfterSwipeAnimation(action: () => void) {
  setTimeout(action, 300);
}
