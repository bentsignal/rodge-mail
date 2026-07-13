import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useRouter } from "expo-router";
import { usePaginatedQuery, useQuery } from "convex/react";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { ThreadRow } from "../components/thread-row";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import { useMailStore } from "../store";
import { filterMailboxThreads } from "./mailbox-controls";
import { MailboxThreadList } from "./mailbox-thread-list";
import { useArchiveActions } from "./use-archive-actions";

const pageSize = 30;

export function ArchiveMailbox({
  primary,
  searchTerm,
  temporarySearch,
  onAccountChange,
}: {
  onAccountChange: (value: MailAccountFilter) => void;
  primary: string;
  searchTerm: string;
  temporarySearch?: {
    onChange: (value: string) => void;
    value: string;
  };
}) {
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
  const searchResults = useQuery(
    api.mail.archiveQueries.searchArchive,
    normalizedSearchTerm
      ? { accountId, searchTerm: normalizedSearchTerm }
      : "skip",
  );
  const isSearching = normalizedSearchTerm.length > 0;
  const sourceRows = isSearching ? (searchResults ?? []) : archive.results;
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
