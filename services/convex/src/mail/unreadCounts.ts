export function getUnreadCountSummary(
  threads: {
    accountId: string;
    inInbox?: boolean;
    unreadCount: number;
  }[],
) {
  const counts = new Map<string, number>();
  let all = 0;
  for (const thread of threads) {
    if (thread.inInbox === false || thread.unreadCount <= 0) continue;
    all += 1;
    counts.set(thread.accountId, (counts.get(thread.accountId) ?? 0) + 1);
  }
  return { all, byAccount: Object.fromEntries(counts) };
}
