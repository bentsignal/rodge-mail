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
