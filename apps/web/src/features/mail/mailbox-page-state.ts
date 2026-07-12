export function getIsLoadingInbox({
  debouncedSearchQuery,
  hasCachedPage,
  pageStatus,
  searchQuery,
}: {
  debouncedSearchQuery: string;
  hasCachedPage: boolean;
  pageStatus: string;
  searchQuery: string;
}) {
  return (
    searchQuery.trim().length === 0 &&
    debouncedSearchQuery.length === 0 &&
    pageStatus === "LoadingFirstPage" &&
    !hasCachedPage
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
