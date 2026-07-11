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
