export interface AccountScopedItem {
  accountId: string;
}

export function readCachedAccountPage<T extends AccountScopedItem>({
  accountId,
  cache,
  key,
  unifiedKey,
}: {
  accountId: string | undefined;
  cache: ReadonlyMap<string, T[]>;
  key: string;
  unifiedKey: string | undefined;
}) {
  const exact = cache.get(key);
  if (exact) return { isCached: true, items: exact };
  if (!accountId || !unifiedKey) return { isCached: false, items: [] };

  const unified = cache.get(unifiedKey);
  if (!unified) return { isCached: false, items: [] };
  const items = unified.filter((item) => item.accountId === accountId);
  return items.length > 0
    ? { isCached: true, items }
    : { isCached: false, items: [] };
}
