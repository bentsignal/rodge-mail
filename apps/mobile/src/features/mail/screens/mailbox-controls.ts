import type { MailThread } from "@rodge-mail/features/mail";

export type MailboxFilter = "all" | "read" | "unread";

export function filterMailboxThreads(
  threads: MailThread[],
  filter: MailboxFilter,
) {
  if (filter === "read") return threads.filter((thread) => thread.isRead);
  if (filter === "unread") return threads.filter((thread) => !thread.isRead);
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
  if (filter === "read") return "Read";
  if (filter === "unread") return "Unread";
  return "Filter";
}
