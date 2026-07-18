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
}: {
  debouncedSearchQuery: string;
  pageStatus: string;
}) {
  return debouncedSearchQuery.length > 0 && pageStatus === "LoadingFirstPage";
}

export function getCanInitializeSearchSelection({
  debouncedSearchQuery,
  isSearchingInbox,
  searchQuery,
}: {
  debouncedSearchQuery: string;
  isSearchingInbox: boolean;
  searchQuery: string;
}) {
  return searchQuery.trim() === debouncedSearchQuery && !isSearchingInbox;
}
