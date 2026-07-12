export function getVisibleInboxThreads<T extends { isRead: boolean }>({
  inboxThreads,
  isSearching,
  searchThreads,
  showUnreadOnly,
}: {
  inboxThreads: T[];
  isSearching: boolean;
  searchThreads: T[];
  showUnreadOnly: boolean;
}) {
  const threads = isSearching ? searchThreads : inboxThreads;
  if (!showUnreadOnly) return threads;
  return threads.filter((thread) => !thread.isRead);
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
