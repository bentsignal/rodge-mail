import type { MailThread } from "@rodge-mail/features/mail";

import type { MobileMailbox } from "../store";

export type MailboxFilter = "all" | "unread";

export function parseMobileMailbox(value: string | undefined) {
  if (value === "archive" || value === "spam") return value;
  return "inbox";
}

export function getMailboxSearchPlaceholder(mailbox: MobileMailbox) {
  if (mailbox === "archive") return "Search archive";
  if (mailbox === "spam") return "Search spam";
  return undefined;
}

export function filterMailboxThreads(
  threads: MailThread[],
  filter: MailboxFilter,
  retainedUnreadIds: ReadonlySet<string> = new Set(),
) {
  if (filter === "unread") {
    return threads.filter(
      (thread) => !thread.isRead || retainedUnreadIds.has(thread.id),
    );
  }
  return threads;
}

export function toggleSelectedThread(
  selectedIds: ReadonlySet<string>,
  threadId: string,
) {
  const next = new Set(selectedIds);
  if (next.has(threadId)) next.delete(threadId);
  else next.add(threadId);
  return next;
}

export function getFilterLabel(filter: MailboxFilter) {
  if (filter === "unread") return "Unread";
  return "All";
}
