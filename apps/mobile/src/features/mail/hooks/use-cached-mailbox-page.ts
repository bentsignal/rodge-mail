import { useEffect } from "react";

import { readCachedAccountPage } from "@rodge-mail/features/mail";

import type { MailStoreValue } from "../store";
import type { AccountPageCache } from "./use-account-page-cache";
import { useMailStore } from "../store";

export function getMailboxPageKey(
  mailbox: string,
  accountId: string | undefined,
  searchTerm = "",
) {
  return `${mailbox}:${accountId ?? "all"}:${searchTerm}`;
}

/**
 * Each mailbox and account's last settled page, kept for the session, so
 * switching either one shows rows at once while the next page loads. An
 * account reads the mailbox's unified page narrowed to it until its own page
 * arrives. The list never goes empty between pages, which is what used to
 * leave its top row under the navigation bar.
 */
export function useCachedMailboxPage<T extends { accountId: string }>({
  accountId,
  isPending,
  mailbox,
  rows,
  searchTerm = "",
  selectCache,
}: {
  accountId: string | undefined;
  isPending: boolean;
  mailbox: string;
  rows: T[];
  searchTerm?: string;
  selectCache: (store: MailStoreValue) => AccountPageCache<T>;
}) {
  const { pages, writePage } = useMailStore(selectCache);
  const key = getMailboxPageKey(mailbox, accountId, searchTerm);
  // eslint-disable-next-line no-restricted-syntax -- The settled page comes from a Convex subscription; no event marks its arrival.
  useEffect(() => {
    if (!isPending) writePage(key, rows);
  }, [isPending, key, rows, writePage]);
  if (!isPending) return rows;
  return readCachedAccountPage({
    accountId,
    cache: pages,
    key,
    unifiedKey: searchTerm ? undefined : getMailboxPageKey(mailbox, undefined),
  }).items;
}
