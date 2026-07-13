import type { MailThread } from "@rodge-mail/features/mail";

export type MailboxFilter = "all" | "unread";

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
