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
  const [settledPage, setSettledPage] = useState(() => ({
    key: getResultsKey(initialInbox),
    results: initialInbox,
  }));
  const useInitialInbox =
    !isSearching &&
    accountId === undefined &&
    activePage.status === "LoadingFirstPage";

  const activeResultsKey = getResultsKey(activePage.results);
  if (
    activePage.status !== "LoadingFirstPage" &&
    activeResultsKey !== settledPage.key
  ) {
    setSettledPage({ key: activeResultsKey, results: activePage.results });
  }

  const fallbackResults = useInitialInbox ? initialInbox : settledPage.results;
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
    term: string;
  }>({ ids: [], term: "" });

  // eslint-disable-next-line no-restricted-syntax -- Semantic search is an asynchronous supplement to the live lexical query.
  useEffect(() => {
    if (searchTerm.length < 2) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      void runSemanticSearch({ accountId, searchTerm, limit: 30 })
        .then((matches) => {
          if (!active) return;
          setResult({
            ids: matches.map((match) => match.messageId),
            term: searchTerm,
          });
        })
        .catch(() => {
          if (active) setResult({ ids: [], term: searchTerm });
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [accountId, runSemanticSearch, searchTerm]);

  const ids = result.term === searchTerm ? result.ids : [];
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
      (result.term !== searchTerm ||
        (ids.length > 0 && messages.data === undefined)),
    results: messages.data ?? [],
  };
}

function getResultsKey(messages: InboxMessage[]) {
  return messages.map((message) => message._id).join(":");
}

export function getIsLoadingInbox({
  deferredSearchQuery,
  hasVisibleMessages,
  pageStatus,
  searchQuery,
}: {
  deferredSearchQuery: string;
  hasVisibleMessages: boolean;
  pageStatus: string;
  searchQuery: string;
}) {
  return (
    searchQuery.trim().length === 0 &&
    deferredSearchQuery.length === 0 &&
    pageStatus === "LoadingFirstPage" &&
    !hasVisibleMessages
  );
}

export function getIsSearchingInbox({
  deferredSearchQuery,
  pageStatus,
  searchQuery,
}: {
  deferredSearchQuery: string;
  pageStatus: string;
  searchQuery: string;
}) {
  return (
    searchQuery.trim() !== deferredSearchQuery ||
    (deferredSearchQuery.length > 0 && pageStatus === "LoadingFirstPage")
  );
}
