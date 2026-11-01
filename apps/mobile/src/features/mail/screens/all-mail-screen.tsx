import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { usePaginatedQuery } from "convex/react";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import type { OtherMailbox } from "../store";
import type { MailboxFilter } from "./mailbox-controls";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { ThreadRow } from "../components/thread-row";
import { getThreadTag } from "../components/thread-row-presentation";
import { toConvexId } from "../lib/convex-id";
import { toAllMailThreads } from "../lib/convex-mail";
import { useMailStore } from "../store";
import { MAIL_SEARCH_DEBOUNCE_MS } from "./inbox-list-state";
import { filterMailboxThreads } from "./mailbox-controls";
import { MailboxThreadList } from "./mailbox-thread-list";
import { useMoveToInbox } from "./use-move-to-inbox";

const pageSize = 30;

export function AllMailMailbox({
  onAccountChange,
  onMailboxSelect,
  primary,
  searchMode,
  searchTerm,
}: {
  onAccountChange: (value: MailAccountFilter) => void;
  onMailboxSelect: (mailbox: OtherMailbox) => void;
  primary: string;
  searchMode: boolean;
  searchTerm: string;
}) {
  const router = useRouter();
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const moveToInbox = useMoveToInbox();
  const [filter, setFilter] = useState<MailboxFilter>("all");
  const accountId =
    accountFilter === "all"
      ? undefined
      : toConvexId<"mailAccounts">(accountFilter);
  const normalizedSearchTerm = searchTerm.trim();
  const delayedSearchTerm = useDebouncedValue(
    normalizedSearchTerm,
    MAIL_SEARCH_DEBOUNCE_MS,
  );
  const activeSearchTerm = normalizedSearchTerm ? delayedSearchTerm : "";
  const isSearching = activeSearchTerm.length > 0;
  const allMail = usePaginatedQuery(
    api.mail.queries.listAllMail,
    isSearching ? "skip" : { accountId },
    { initialNumItems: pageSize },
  );
  const search = usePaginatedQuery(
    api.mail.queries.searchHeaders,
    isSearching
      ? { accountId, scope: "all", searchTerm: activeSearchTerm }
      : "skip",
    { initialNumItems: pageSize },
  );
  const activePage = isSearching ? search : allMail;
  const rows = useSettledRows(
    activePage.results,
    activePage.status === "LoadingFirstPage",
    accountId,
  );
  const threads = filterMailboxThreads(toAllMailThreads(rows), filter);

  function renderThread({ item }: LegendListRenderItemProps<MailThread>) {
    return (
      <ThreadRow
        locationTag={getThreadTag({
          accountFilter,
          accounts,
          isSearch: isSearching,
          thread: item,
        })}
        mailbox="all"
        thread={item}
        onMoveToInbox={() => moveToInbox(item.id)}
        onOpen={() =>
          router.push({
            pathname: "/(tabs)/(inbox)/thread/[id]",
            params: { id: item.id, mailbox: "all" },
          })
        }
      />
    );
  }
  return (
    <MailboxThreadList
      accountFilter={accountFilter}
      accounts={accounts}
      bulkActions={[]}
      data={threads}
      emptyIsLoading={
        activePage.status === "LoadingFirstPage" && rows.length === 0
      }
      filter={filter}
      footerIsLoading={activePage.status === "LoadingMore"}
      mailbox="all"
      primary={primary}
      renderThread={renderThread}
      searchMode={searchMode}
      searchTerm={isSearching ? normalizedSearchTerm : undefined}
      selectedCount={0}
      selectionEnabled={false}
      selectionMode={false}
      onAccountChange={onAccountChange}
      onFilterChange={setFilter}
      onLoadMore={() => activePage.loadMore(pageSize)}
      onMailboxSelect={onMailboxSelect}
      onToggleSelection={() => undefined}
      pageStatus={activePage.status}
    />
  );
}

/**
 * Keeps the last page on screen while the next one loads, narrowed to the
 * chosen account the way the inbox narrows its cached page.
 */
function useSettledRows<T extends { accountId: string }>(
  rows: T[],
  isPending: boolean,
  accountId: string | undefined,
) {
  const [settled, setSettled] = useState<T[]>();
  // eslint-disable-next-line no-restricted-syntax -- Keep the last settled page on screen while the next Convex subscription loads.
  useEffect(() => {
    if (isPending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Convex query settlement is an external subscription snapshot.
    setSettled(rows);
  }, [isPending, rows]);
  if (!isPending) return rows;
  const visible = settled ?? rows;
  if (!accountId) return visible;
  return visible.filter((row) => row.accountId === accountId);
}
