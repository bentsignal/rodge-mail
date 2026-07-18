import { useEffect, useState } from "react";
// eslint-disable-next-line no-restricted-imports -- Semantic hydration is conditional and cannot be route-preloaded.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction, usePaginatedQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import {
  getStrongSemanticMessageIds,
  mergeSearchResults,
  readCachedAccountPage,
} from "@rodge-mail/features/mail";

import type { InboxMessage } from "./types";
import { MAIL_PAGE_SIZE } from "./constants";
import {
  getMailboxTransitionPending,
  useStableMailboxResults,
} from "./mailbox-page-transition";

export {
  getCanInitializeSearchSelection,
  getIsLoadingInbox,
  getIsSearchingInbox,
} from "./mailbox-page-state";

export function useMailboxPage({
  accountId,
  initialAccountId,
  initialInbox,
  initialUnreadOnly,
  searchTerm,
  unreadOnly,
}: {
  accountId: InboxMessage["accountId"] | undefined;
  initialAccountId: InboxMessage["accountId"] | undefined;
  initialInbox: InboxMessage[];
  initialUnreadOnly: boolean;
  searchTerm: string;
  unreadOnly: boolean;
}) {
  const isSearching = searchTerm.length > 0;
  const inbox = usePaginatedQuery(
    api.mail.queries.listInbox,
    isSearching ? "skip" : { accountId, unreadOnly },
    { initialNumItems: MAIL_PAGE_SIZE },
  );
  const search = usePaginatedQuery(
    api.mail.queries.searchHeaders,
    isSearching ? { accountId, searchTerm, unreadOnly } : "skip",
    { initialNumItems: MAIL_PAGE_SIZE },
  );
  const semantic = useSemanticMailSearch({
    accountId,
    searchTerm,
    unreadOnly,
  });
  const activePage = isSearching ? search : inbox;
  const scopeKey = getMailboxScopeKey(accountId, searchTerm, unreadOnly);
  const useInitialInbox =
    !isSearching &&
    accountId === initialAccountId &&
    unreadOnly === initialUnreadOnly &&
    activePage.status === "LoadingFirstPage";
  const cachedPage = useSettledMailboxPage({
    accountId,
    activeResults: activePage.results,
    initialInbox,
    initialAccountId,
    initialUnreadOnly,
    isSearching,
    scopeKey,
    status: activePage.status,
    unreadOnly,
  });
  const fallbackResults = useInitialInbox ? initialInbox : cachedPage.items;
  const lexicalResults = getVisibleResults(
    activePage.status,
    activePage.results,
    fallbackResults,
  );
  const candidateResults = isSearching
    ? mergeSearchResults(
        lexicalResults,
        semantic.results,
        (message) => message._id,
      )
    : lexicalResults;
  const isPending = getMailboxTransitionPending(activePage.status);
  const stablePage = useStableMailboxResults({
    accountId,
    candidateResults,
    fallbackIsCached: useInitialInbox || cachedPage.isCached,
    initialAccountId,
    initialInbox,
    initialUnreadOnly,
    isPending,
    unreadOnly,
  });
  return {
    ...activePage,
    hasCachedPage: stablePage.hasStablePage,
    isSemanticSearching: semantic.isLoading,
    results: stablePage.results,
    status: activePage.status,
  };
}

function useSettledMailboxPage({
  accountId,
  activeResults,
  initialInbox,
  initialAccountId,
  initialUnreadOnly,
  isSearching,
  scopeKey,
  status,
  unreadOnly,
}: {
  accountId: InboxMessage["accountId"] | undefined;
  activeResults: InboxMessage[];
  initialInbox: InboxMessage[];
  initialAccountId: InboxMessage["accountId"] | undefined;
  initialUnreadOnly: boolean;
  isSearching: boolean;
  scopeKey: string;
  status: string;
  unreadOnly: boolean;
}) {
  const [cache, setCache] = useState(
    () =>
      new Map<string, InboxMessage[]>([
        [
          getMailboxScopeKey(initialAccountId, "", initialUnreadOnly),
          initialInbox,
        ],
      ]),
  );

  // eslint-disable-next-line no-restricted-syntax -- Cache the latest settled Convex page so revisiting a mailbox never discards visible data.
  useEffect(() => {
    if (status === "LoadingFirstPage") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The Convex page is an external subscription snapshot.
    setCache((current) => {
      if (current.get(scopeKey) === activeResults) return current;
      const next = new Map(current);
      next.set(scopeKey, activeResults);
      return next;
    });
  }, [activeResults, scopeKey, status]);

  return readCachedAccountPage({
    accountId,
    cache,
    key: scopeKey,
    unifiedKey: isSearching
      ? undefined
      : getMailboxScopeKey(undefined, "", unreadOnly),
  });
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
  unreadOnly,
}: {
  accountId: InboxMessage["accountId"] | undefined;
  searchTerm: string;
  unreadOnly: boolean;
}) {
  const runSemanticSearch = useAction(api.embedding.search.semanticSearch);
  const [result, setResult] = useState<{
    ids: InboxMessage["_id"][];
    scopeKey: string;
  }>({ ids: [], scopeKey: "" });
  const scopeKey = getMailboxScopeKey(accountId, searchTerm, unreadOnly);

  // eslint-disable-next-line no-restricted-syntax -- Semantic search is an asynchronous supplement to the live lexical query.
  useEffect(() => {
    if (searchTerm.length < 2) return;
    let active = true;
    void runSemanticSearch({ accountId, searchTerm, limit: 30 })
      .then((matches) => {
        if (!active) return;
        setResult({
          ids: getStrongSemanticMessageIds(matches),
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
      ids.length > 0 ? { messageIds: ids, unreadOnly } : "skip",
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

export function getMailboxScopeKey(
  accountId: string | undefined,
  searchTerm: string,
  unreadOnly: boolean,
) {
  return `${accountId ?? "all"}:${unreadOnly ? "unread" : "all"}:${searchTerm}`;
}
