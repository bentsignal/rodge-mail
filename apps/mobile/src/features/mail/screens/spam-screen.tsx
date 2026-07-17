import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { usePaginatedQuery } from "convex/react";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import type { MailboxFilter } from "./mailbox-controls";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { ThreadRow } from "../components/thread-row";
import { toMailThreads } from "../lib/convex-mail";
import { useMailStore } from "../store";
import { MAIL_SEARCH_DEBOUNCE_MS } from "./inbox-list-state";
import { filterMailboxThreads } from "./mailbox-controls";
import { MailboxThreadList } from "./mailbox-thread-list";
import { filterSpamThreads } from "./spam-mailbox";

const pageSize = 30;

export function SpamMailbox({
  onAccountChange,
  onArchiveSelect,
  primary,
  searchTerm,
  temporarySearch,
}: {
  onAccountChange: (value: MailAccountFilter) => void;
  onArchiveSelect: () => void;
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
  const [filter, setFilter] = useState<MailboxFilter>("all");
  const spam = usePaginatedQuery(
    api.mail.queries.listSpam,
    {},
    { initialNumItems: pageSize },
  );
  const normalizedSearchTerm = searchTerm.trim();
  const delayedSearchTerm = useDebouncedValue(
    normalizedSearchTerm,
    MAIL_SEARCH_DEBOUNCE_MS,
  );
  const activeSearchTerm = normalizedSearchTerm ? delayedSearchTerm : "";
  const threads = filterMailboxThreads(
    filterSpamThreads(toMailThreads(spam.results), activeSearchTerm),
    filter,
  );

  function renderThread({ item }: LegendListRenderItemProps<MailThread>) {
    return (
      <ThreadRow
        mailbox="spam"
        thread={item}
        onOpen={() =>
          router.push({
            pathname: "/(tabs)/(inbox)/thread/[id]",
            params: { id: item.id, mailbox: "spam" },
          })
        }
      />
    );
  }
  function loadMore() {
    if (spam.status === "CanLoadMore") spam.loadMore(pageSize);
  }
  return (
    <MailboxThreadList
      accountFilter={accountFilter}
      accounts={accounts}
      bulkActions={[]}
      data={threads}
      emptyIsLoading={spam.status === "LoadingFirstPage"}
      filter={filter}
      footerIsLoading={spam.status === "LoadingMore"}
      mailbox="spam"
      primary={primary}
      renderThread={renderThread}
      searchTerm={activeSearchTerm ? normalizedSearchTerm : undefined}
      selectedCount={0}
      selectionEnabled={false}
      selectionMode={false}
      temporarySearch={temporarySearch}
      onAccountChange={onAccountChange}
      onArchiveSelect={onArchiveSelect}
      onEndReached={loadMore}
      onFilterChange={setFilter}
      onSpamSelect={() => undefined}
      onToggleSelection={() => undefined}
    />
  );
}
