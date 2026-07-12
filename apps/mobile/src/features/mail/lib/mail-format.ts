import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { sortPinnedMailRows } from "@rodge-mail/features/mail";

export function formatMessageTime(value: string) {
  const date = new Date(value);
  const now = new Date("2026-07-09T16:00:00.000Z");
  const sameDay = date.toDateString() === now.toDateString();

  return sameDay
    ? new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
}

export function filterAndSortThreads(
  threads: MailThread[],
  accountFilter: MailAccountFilter,
) {
  return sortPinnedMailRows(
    threads.filter(
      (thread) => accountFilter === "all" || thread.accountId === accountFilter,
    ),
  );
}

export function threadMatchesSearch(thread: MailThread, searchTerm: string) {
  const normalized = searchTerm.trim().toLocaleLowerCase();
  if (!normalized) return true;

  return [
    thread.sender.name,
    thread.sender.address,
    thread.subject,
    thread.preview,
    ...thread.messages.flatMap((message) => message.body),
  ].some((value) => value.toLocaleLowerCase().includes(normalized));
}
