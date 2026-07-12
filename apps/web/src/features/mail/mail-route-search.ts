export interface MailRouteSearch {
  mailbox?: string;
  unread?: true;
}

export function normalizeMailRouteSearch(search: Record<string, unknown>) {
  const mailbox = typeof search.mailbox === "string" ? search.mailbox : null;
  const unread = search.unread === true || search.unread === "true";
  return {
    ...(mailbox ? { mailbox } : {}),
    ...(unread ? { unread } : {}),
  };
}

export function withMailboxSearch(
  search: MailRouteSearch,
  accountFilter: string,
) {
  return {
    ...search,
    mailbox: accountFilter === "all" ? undefined : accountFilter,
  };
}

export function withUnreadSearch(search: MailRouteSearch, unreadOnly: boolean) {
  const next = {
    ...search,
    unread: unreadOnly ? true : undefined,
  } satisfies MailRouteSearch;
  return next;
}
