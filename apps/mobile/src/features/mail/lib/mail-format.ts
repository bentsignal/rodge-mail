import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { sortPinnedMailRows } from "@rodge-mail/features/mail";
import { formatRelativeTime } from "@rodge-mail/std/relative-time";

export function formatInboxMessageTime(value: string, now = Date.now()) {
  return formatRelativeTime(new Date(value).getTime(), now);
}

export function formatMessageTime(value: string) {
  const date = new Date(value);
  const now = new Date();
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
