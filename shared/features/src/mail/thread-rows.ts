export function dedupeThreadRows<T extends { threadId: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.threadId)) return false;
    seen.add(row.threadId);
    return true;
  });
}
