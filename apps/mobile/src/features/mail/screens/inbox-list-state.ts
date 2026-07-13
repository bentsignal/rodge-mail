export const MAIL_SEARCH_DEBOUNCE_MS = 600;

export function getVisibleInboxThreads<T extends { isRead: boolean }>({
  inboxThreads,
  isSearching,
  searchIsPending = false,
  searchThreads,
  settledSearchThreads,
  showUnreadOnly,
}: {
  inboxThreads: T[];
  isSearching: boolean;
  searchIsPending?: boolean;
  searchThreads: T[];
  settledSearchThreads?: T[];
  showUnreadOnly: boolean;
}) {
  const threads = resolveVisibleSearchThreads({
    inboxThreads,
    isSearching,
    searchIsPending,
    searchThreads,
    settledSearchThreads,
  });
  if (!showUnreadOnly) return threads;
  return threads.filter((thread) => !thread.isRead);
}

function resolveVisibleSearchThreads<T>({
  inboxThreads,
  isSearching,
  searchIsPending,
  searchThreads,
  settledSearchThreads,
}: {
  inboxThreads: T[];
  isSearching: boolean;
  searchIsPending: boolean;
  searchThreads: T[];
  settledSearchThreads: T[] | undefined;
}) {
  if (!isSearching) return inboxThreads;
  if (!searchIsPending) return searchThreads;
  return settledSearchThreads ?? inboxThreads;
}

export function getEmptyIsLoading({
  debouncedSearchTerm,
  isLoading,
  isSearching,
  lexicalResultCount,
  searchIsLoading,
  searchStatus,
  searchTerm,
}: {
  debouncedSearchTerm: string;
  isLoading: boolean;
  isSearching: boolean;
  lexicalResultCount: number;
  searchIsLoading: boolean;
  searchStatus: string;
  searchTerm: string;
}) {
  if (!isSearching) return isLoading;
  return (
    debouncedSearchTerm !== searchTerm.trim() ||
    searchStatus === "LoadingFirstPage" ||
    (lexicalResultCount === 0 && searchIsLoading)
  );
}

export function getFooterIsLoading({
  isLoadingMore,
  isSearching,
  searchIsLoading,
  searchStatus,
}: {
  isLoadingMore: boolean;
  isSearching: boolean;
  searchIsLoading: boolean;
  searchStatus: string;
}) {
  if (!isSearching) return isLoadingMore;
  return searchStatus === "LoadingMore" || searchIsLoading;
}

export function getInboxListFeedback({
  emptyIsLoading,
  footerIsLoading,
  resultCount,
}: {
  emptyIsLoading: boolean;
  footerIsLoading: boolean;
  resultCount: number;
}) {
  if (resultCount === 0) {
    return {
      emptyIsLoading: emptyIsLoading || footerIsLoading,
      footerIsLoading: false,
    };
  }
  return { emptyIsLoading, footerIsLoading };
}
