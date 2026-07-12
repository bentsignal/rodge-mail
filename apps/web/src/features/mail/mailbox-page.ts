import { useEffect, useState } from "react";
// eslint-disable-next-line no-restricted-imports -- Semantic hydration is conditional and cannot be route-preloaded.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction, usePaginatedQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import { mergeSearchResults } from "@rodge-mail/features/mail";

import type { InboxMessage } from "./types";
import { MAIL_PAGE_SIZE } from "./constants";

export { getIsLoadingInbox, getIsSearchingInbox } from "./mailbox-page-state";

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
  const useInitialInbox =
    !isSearching &&
    accountId === undefined &&
    activePage.status === "LoadingFirstPage";
  const settledResults = useSettledMailboxPage({
    activeResults: activePage.results,
    initialInbox,
    scopeKey,
    status: activePage.status,
  });
  const fallbackResults = useInitialInbox ? initialInbox : settledResults;
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

function useSettledMailboxPage({
  activeResults,
  initialInbox,
  scopeKey,
  status,
}: {
  activeResults: InboxMessage[];
  initialInbox: InboxMessage[];
  scopeKey: string;
  status: string;
}) {
  const [cache, setCache] = useState(() => ({
    observedResultsKey: getResultsKey(initialInbox),
    observedScopeKey: getMailboxScopeKey(undefined, ""),
    pages: new Map<string, InboxMessage[]>([
      [getMailboxScopeKey(undefined, ""), initialInbox],
    ]),
  }));
  const activeResultsKey = getResultsKey(activeResults);
  const hasChanged =
    cache.observedScopeKey !== scopeKey ||
    cache.observedResultsKey !== activeResultsKey;

  if (status !== "LoadingFirstPage" && hasChanged) {
    const pages = new Map(cache.pages);
    pages.set(scopeKey, activeResults);
    setCache({
      observedResultsKey: activeResultsKey,
      observedScopeKey: scopeKey,
      pages,
    });
  }

  return cache.pages.get(scopeKey) ?? [];
}

function getResultsKey(messages: InboxMessage[]) {
  return messages.map((message) => message._id).join(":");
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

function getMailboxScopeKey(
  accountId: InboxMessage["accountId"] | undefined,
  searchTerm: string,
) {
  return `${accountId ?? "all"}:${searchTerm}`;
}
