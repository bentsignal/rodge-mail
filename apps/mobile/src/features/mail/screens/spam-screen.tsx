import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { usePaginatedQuery } from "convex/react";

import type { MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import type { MailboxFilter } from "./mailbox-controls";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { ThreadRow } from "../components/thread-row";
import { useCachedMailboxPage } from "../hooks/use-cached-mailbox-page";
import { toConvexId } from "../lib/convex-id";
import { toMailThreads } from "../lib/convex-mail";
import { useMailStore } from "../store";
import { MAIL_SEARCH_DEBOUNCE_MS } from "./inbox-list-state";
import { filterMailboxThreads } from "./mailbox-controls";
import { MailboxThreadList } from "./mailbox-thread-list";
import { filterSpamThreads } from "./spam-mailbox";

const pageSize = 30;

export function SpamMailbox({
  primary,
  searchMode,
  searchTerm,
}: {
  primary: string;
  searchMode: boolean;
  searchTerm: string;
}) {
  const router = useRouter();
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const [filter, setFilter] = useState<MailboxFilter>("all");
  const accountId =
    accountFilter === "all"
      ? undefined
      : toConvexId<"mailAccounts">(accountFilter);
  const spam = usePaginatedQuery(
    api.mail.queries.listSpam,
    { accountId },
    { initialNumItems: pageSize },
  );
  const isPending = spam.status === "LoadingFirstPage";
  const rows = useCachedMailboxPage({
    accountId,
    isPending,
    mailbox: "spam",
    rows: spam.results,
    selectCache: (store) => store.mailboxPages,
  });
  const needsMoreRows =
    accountId !== undefined &&
    spam.status === "CanLoadMore" &&
    spam.results.length < pageSize;
  const { loadMore } = spam;
  // eslint-disable-next-line no-restricted-syntax -- One account's spam can come back short (listSpam filters after reading), and a short list never scrolls to ask for more.
  useEffect(() => {
    if (needsMoreRows) loadMore(pageSize);
  }, [loadMore, needsMoreRows]);
  const normalizedSearchTerm = searchTerm.trim();
  const delayedSearchTerm = useDebouncedValue(
    normalizedSearchTerm,
    MAIL_SEARCH_DEBOUNCE_MS,
  );
  const activeSearchTerm = normalizedSearchTerm ? delayedSearchTerm : "";
  const threads = filterMailboxThreads(
    filterSpamThreads(toMailThreads(rows), activeSearchTerm),
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
  return (
    <MailboxThreadList
      accountFilter={accountFilter}
      accounts={accounts}
      bulkActions={[]}
      data={threads}
      emptyIsLoading={isPending || needsMoreRows}
      filter={filter}
      footerIsLoading={spam.status === "LoadingMore"}
      mailbox="spam"
      primary={primary}
      renderThread={renderThread}
      searchMode={searchMode}
      searchTerm={activeSearchTerm ? normalizedSearchTerm : undefined}
      selectedCount={0}
      selectionEnabled={false}
      selectionMode={false}
      onFilterChange={setFilter}
      onLoadMore={() => spam.loadMore(pageSize)}
      onToggleSelection={() => undefined}
      pageStatus={spam.status}
    />
  );
}
