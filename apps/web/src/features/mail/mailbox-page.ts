import { useEffect, useState } from "react";
// eslint-disable-next-line no-restricted-imports -- Semantic hydration is conditional and cannot be route-preloaded.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction, usePaginatedQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import { mergeSearchResults } from "@rodge-mail/features/mail";

import type { InboxMessage } from "./types";
import { MAIL_PAGE_SIZE } from "./constants";

export function useMailboxPage({
  accountId,
  initialInbox,
  searchTerm,
}: {
  accountId: InboxMessage["accountId"] | undefined;
  initialInbox: InboxMessage[];
  searchTerm: string;
}) {
  const isSearching = searchTerm.length > 0;
  const inbox = usePaginatedQuery(
    api.mail.queries.listInbox,
    isSearching ? "skip" : { accountId },
    { initialNumItems: MAIL_PAGE_SIZE },
  );
  const search = usePaginatedQuery(
    api.mail.queries.searchHeaders,
    isSearching ? { accountId, searchTerm } : "skip",
    { initialNumItems: MAIL_PAGE_SIZE },
  );
  const semantic = useSemanticMailSearch({ accountId, searchTerm });
  const activePage = isSearching ? search : inbox;
  const scopeKey = getMailboxScopeKey(accountId, searchTerm);
  const [settledPage, setSettledPage] = useState(() => ({
    resultsKey: getResultsKey(initialInbox),
    results: initialInbox,
    scopeKey: getMailboxScopeKey(undefined, ""),
  }));
  const useInitialInbox =
    !isSearching &&
    accountId === undefined &&
    activePage.status === "LoadingFirstPage";

  const activeResultsKey = getResultsKey(activePage.results);
  if (
    shouldUpdateSettledPage({
      activeResultsKey,
      scopeKey,
      settledPage,
      status: activePage.status,
    })
  ) {
    setSettledPage({
      resultsKey: activeResultsKey,
      results: activePage.results,
      scopeKey,
    });
  }

  const fallbackResults = useInitialInbox
    ? initialInbox
    : settledPage.scopeKey === scopeKey
      ? settledPage.results
      : [];
  const lexicalResults = getVisibleResults(
    activePage.status,
    activePage.results,
    fallbackResults,
  );
  const results = isSearching
    ? mergeSearchResults(
        lexicalResults,
        semantic.results,
        (message) => message._id,
      )
    : lexicalResults;
  return {
    ...activePage,
    isSemanticSearching: semantic.isLoading,
    results,
    status: getSmartSearchStatus(
      activePage.status,
      isSearching,
      semantic.isLoading,
      results.length,
    ),
  };
}

function getSmartSearchStatus(
  status: string,
  isSearching: boolean,
  semanticIsLoading: boolean,
  resultCount: number,
) {
  return isSearching && semanticIsLoading && resultCount === 0
    ? "LoadingFirstPage"
    : status;
}

function getVisibleResults(
  status: string,
  results: InboxMessage[],
  fallback: InboxMessage[],
) {
  return status === "LoadingFirstPage" ? fallback : results;
}

function useSemanticMailSearch({
  accountId,
  searchTerm,
}: {
  accountId: InboxMessage["accountId"] | undefined;
  searchTerm: string;
}) {
  const runSemanticSearch = useAction(api.embedding.search.semanticSearch);
  const [result, setResult] = useState<{
    ids: InboxMessage["_id"][];
    scopeKey: string;
  }>({ ids: [], scopeKey: "" });
  const scopeKey = getMailboxScopeKey(accountId, searchTerm);

  // eslint-disable-next-line no-restricted-syntax -- Semantic search is an asynchronous supplement to the live lexical query.
  useEffect(() => {
    if (searchTerm.length < 2) return;
    let active = true;
    void runSemanticSearch({ accountId, searchTerm, limit: 30 })
      .then((matches) => {
        if (!active) return;
        setResult({
          ids: matches.map((match) => match.messageId),
          scopeKey,
        });
      })
      .catch(() => {
        if (active) setResult({ ids: [], scopeKey });
      });
    return () => {
      active = false;
    };
  }, [accountId, runSemanticSearch, scopeKey, searchTerm]);

  const ids = result.scopeKey === scopeKey ? result.ids : [];
  const messages = useQuery({
    ...convexQuery(
      api.mail.queries.getMessagesByIds,
      ids.length > 0 ? { messageIds: ids } : "skip",
    ),
    select: (data) => data,
  });
  return {
    isLoading:
      searchTerm.length >= 2 &&
      (result.scopeKey !== scopeKey ||
        (ids.length > 0 && messages.data === undefined)),
    results: ids.length > 0 ? (messages.data ?? []) : [],
  };
}

function getResultsKey(messages: InboxMessage[]) {
  return messages.map((message) => message._id).join(":");
}

function shouldUpdateSettledPage({
  activeResultsKey,
  scopeKey,
  settledPage,
  status,
}: {
  activeResultsKey: string;
  scopeKey: string;
  settledPage: { resultsKey: string; scopeKey: string };
  status: string;
}) {
  return (
    status !== "LoadingFirstPage" &&
    (settledPage.scopeKey !== scopeKey ||
      settledPage.resultsKey !== activeResultsKey)
  );
}

function getMailboxScopeKey(
  accountId: InboxMessage["accountId"] | undefined,
  searchTerm: string,
) {
  return `${accountId ?? "all"}:${searchTerm}`;
}

export function getIsLoadingInbox({
  debouncedSearchQuery,
  hasVisibleMessages,
  pageStatus,
  searchQuery,
}: {
  debouncedSearchQuery: string;
  hasVisibleMessages: boolean;
  pageStatus: string;
  searchQuery: string;
}) {
  return (
    searchQuery.trim().length === 0 &&
    debouncedSearchQuery.length === 0 &&
    pageStatus === "LoadingFirstPage" &&
    !hasVisibleMessages
  );
}

export function getIsSearchingInbox({
  debouncedSearchQuery,
  pageStatus,
  searchQuery,
}: {
  debouncedSearchQuery: string;
  pageStatus: string;
  searchQuery: string;
}) {
  return (
    searchQuery.trim() !== debouncedSearchQuery ||
    (debouncedSearchQuery.length > 0 && pageStatus === "LoadingFirstPage")
  );
}
