import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { usePaginatedQuery, useQuery } from "convex/react";

import type { MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { useColor } from "~/hooks/use-color";
import { ThreadRow } from "../components/thread-row";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import { useMailStore } from "../store";
import { filterMailboxThreads } from "./mailbox-controls";
import { MailboxThreadList } from "./mailbox-thread-list";
import { useArchiveActions } from "./use-archive-actions";

const pageSize = 30;

export function ArchiveScreen() {
  const router = useRouter();
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const [searchTerm, setSearchTerm] = useState("");
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
  const colors = useArchiveSearchColors();

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
            pathname: "/(tabs)/(inbox)/archive/thread/[id]",
            params: { id: item.id },
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
    <>
      <ArchiveSearchBar colors={colors} onSearchChange={setSearchTerm} />
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
        headerInList
        includeTopSafeArea={false}
        mailbox="archive"
        primary={colors.primary}
        renderThread={renderThread}
        searchTerm={isSearching ? normalizedSearchTerm : undefined}
        selectedCount={actions.selectedIds.size}
        selectionMode={actions.selectionMode}
        onAccountChange={(value) => {
          setAccountFilter(value);
          router.replace("/(tabs)/(inbox)");
        }}
        onArchiveSelect={() => undefined}
        onEndReached={loadMore}
        onFilterChange={actions.changeFilter}
        onToggleSelection={actions.toggleSelectionMode}
      />
    </>
  );
}

function ArchiveSearchBar({
  colors,
  onSearchChange,
}: {
  colors: ReturnType<typeof useArchiveSearchColors>;
  onSearchChange: (value: string) => void;
}) {
  return (
    <Stack.SearchBar
      allowToolbarIntegration={false}
      barTintColor={colors.paper}
      hideWhenScrolling={false}
      onCancelButtonPress={() => onSearchChange("")}
      onChangeText={(event) => onSearchChange(event.nativeEvent.text)}
      placeholder="Search archive"
      placement="automatic"
      textColor={colors.foreground}
      tintColor={colors.primary}
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

function useArchiveSearchColors() {
  return {
    foreground: useColor("foreground"),
    paper: useColor("paper"),
    primary: useColor("primary"),
  };
}
