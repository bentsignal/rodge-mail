import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { usePaginatedQuery, useQuery } from "convex/react";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { ThreadRow } from "../components/thread-row";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import { useMailStore } from "../store";
import { MAIL_SEARCH_DEBOUNCE_MS } from "./inbox-list-state";
import { filterMailboxThreads } from "./mailbox-controls";
import { MailboxThreadList } from "./mailbox-thread-list";
import { useArchiveActions } from "./use-archive-actions";

const pageSize = 30;

interface ArchiveMailboxProps {
  onAccountChange: (value: MailAccountFilter) => void;
  onSpamSelect: () => void;
  primary: string;
  searchTerm: string;
  temporarySearch?: {
    onChange: (value: string) => void;
    value: string;
  };
}

export function ArchiveMailbox({
  primary,
  searchTerm,
  temporarySearch,
  onAccountChange,
  onSpamSelect,
}: ArchiveMailboxProps) {
  const router = useRouter();
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const actions = useArchiveActions();
  const accountId = getAccountId(accountFilter);
  const archive = usePaginatedQuery(
    api.mail.archiveQueries.listArchive,
    { accountId },
    { initialNumItems: pageSize },
  );
  const normalizedSearchTerm = searchTerm.trim();
  const delayedSearchTerm = useDebouncedValue(
    normalizedSearchTerm,
    MAIL_SEARCH_DEBOUNCE_MS,
  );
  const activeSearchTerm = normalizedSearchTerm ? delayedSearchTerm : "";
  const searchResults = useQuery(
    api.mail.archiveQueries.searchArchive,
    activeSearchTerm ? { accountId, searchTerm: activeSearchTerm } : "skip",
  );
  const isSearching = activeSearchTerm.length > 0;
  const [settledSearchResults, setSettledSearchResults] =
    useState<typeof searchResults>();

  // eslint-disable-next-line no-restricted-syntax -- Preserve the settled archive search while the next subscription loads.
  useEffect(() => {
    if (!isSearching || searchResults === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Convex query settlement is an external subscription snapshot.
    setSettledSearchResults(searchResults);
  }, [isSearching, searchResults]);

  const sourceRows = isSearching
    ? (searchResults ?? settledSearchResults ?? archive.results)
    : archive.results;
  const threads = filterMailboxThreads(
    toMailThreads(sourceRows),
    actions.filter,
  );

  function renderThread({ item }: LegendListRenderItemProps<MailThread>) {
    return (
      <ThreadRow
        mailbox="archive"
        selected={actions.selectedIds.has(item.id)}
        selectionMode={actions.selectionMode}
        thread={item}
        onDelete={() => actions.confirmDelete([item.id])}
        onOpen={() =>
          router.push({
            pathname: "/(tabs)/(inbox)/thread/[id]",
            params: { id: item.id, mailbox: "archive" },
          })
        }
        onRestore={() => void actions.restoreThreads([item.id])}
        onSelect={() => actions.toggleThreadSelection(item.id)}
      />
    );
  }
  function loadMore() {
    if (!isSearching && archive.status === "CanLoadMore") {
      archive.loadMore(pageSize);
    }
  }
  return (
    <MailboxThreadList
      accountFilter={accountFilter}
      accounts={accounts}
      bulkActions={actions.bulkActions}
      data={threads}
      emptyIsLoading={getArchiveIsLoading(
        isSearching,
        searchResults,
        archive.status,
      )}
      filter={actions.filter}
      footerIsLoading={!isSearching && archive.status === "LoadingMore"}
      mailbox="archive"
      primary={primary}
      renderThread={renderThread}
      searchTerm={isSearching ? normalizedSearchTerm : undefined}
      selectedCount={actions.selectedIds.size}
      selectionMode={actions.selectionMode}
      temporarySearch={temporarySearch}
      onAccountChange={onAccountChange}
      onArchiveSelect={() => undefined}
      onEndReached={loadMore}
      onFilterChange={actions.changeFilter}
      onSpamSelect={onSpamSelect}
      onToggleSelection={actions.toggleSelectionMode}
    />
  );
}

function getAccountId(accountFilter: string) {
  if (accountFilter === "all") return undefined;
  return toConvexId<"mailAccounts">(accountFilter);
}

function getArchiveIsLoading(
  isSearching: boolean,
  searchResults: unknown[] | undefined,
  status: string,
) {
  if (isSearching) return searchResults === undefined;
  return status === "LoadingFirstPage";
}
