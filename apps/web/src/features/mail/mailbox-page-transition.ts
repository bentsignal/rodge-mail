import { useEffect, useState } from "react";

import type { InboxMessage } from "./types";

export function useStableMailboxResults({
  accountId,
  candidateResults,
  fallbackIsCached,
  initialAccountId,
  initialInbox,
  initialUnreadOnly,
  isPending,
  unreadOnly,
}: {
  accountId: string | undefined;
  candidateResults: InboxMessage[];
  fallbackIsCached: boolean;
  initialAccountId: string | undefined;
  initialInbox: InboxMessage[];
  initialUnreadOnly: boolean;
  isPending: boolean;
  unreadOnly: boolean;
}) {
  const [settledByView, setSettledByView] = useState(
    () =>
      new Map<string, { fingerprint: string; results: InboxMessage[] }>([
        [
          getMailboxViewScopeKey(initialAccountId, initialUnreadOnly),
          {
            fingerprint: getMailboxResultsFingerprint(initialInbox),
            results: initialInbox,
          },
        ],
      ]),
  );
  const viewScopeKey = getMailboxViewScopeKey(accountId, unreadOnly);
  const candidateFingerprint = getMailboxResultsFingerprint(candidateResults);

  // eslint-disable-next-line no-restricted-syntax -- Query subscriptions settle outside React and the latest complete view becomes the transition snapshot.
  useEffect(() => {
    if (isPending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The Convex page is an external subscription snapshot.
    setSettledByView((current) => {
      if (current.get(viewScopeKey)?.fingerprint === candidateFingerprint) {
        return current;
      }
      const next = new Map(current);
      next.set(viewScopeKey, {
        fingerprint: candidateFingerprint,
        results: candidateResults,
      });
      return next;
    });
  }, [candidateFingerprint, candidateResults, isPending, viewScopeKey]);

  return resolveMailboxTransitionResults({
    candidateResults,
    fallbackIsCached,
    isPending,
    settledResults: settledByView.get(viewScopeKey)?.results,
  });
}

export function resolveMailboxTransitionResults<Item>({
  candidateResults,
  fallbackIsCached,
  isPending,
  settledResults,
}: {
  candidateResults: Item[];
  fallbackIsCached: boolean;
  isPending: boolean;
  settledResults: Item[] | undefined;
}) {
  if (!isPending) {
    return { hasStablePage: true, results: candidateResults };
  }
  if (settledResults) {
    return { hasStablePage: true, results: settledResults };
  }
  return { hasStablePage: fallbackIsCached, results: candidateResults };
}

export function getMailboxViewScopeKey(
  accountId: string | undefined,
  unreadOnly: boolean,
) {
  return `${accountId ?? "all"}:${unreadOnly ? "unread" : "all"}`;
}

export function getMailboxTransitionPending(
  pageStatus: string,
  isSearching: boolean,
  semanticIsLoading: boolean,
) {
  return (
    pageStatus === "LoadingFirstPage" || (isSearching && semanticIsLoading)
  );
}

function getMailboxResultsFingerprint(results: InboxMessage[]) {
  return results
    .map(
      (message) =>
        `${message._id}:${message.updatedAt}:${message.isRead}:${message.isPinned}:${message.classification?.updatedAt ?? ""}`,
    )
    .join("|");
}
