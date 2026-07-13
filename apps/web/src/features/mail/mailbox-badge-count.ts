export function getMailboxBadgeCount({
  accountFilter,
  archivedCount,
  mailMode,
  unreadCounts,
}: {
  accountFilter: string;
  archivedCount: number;
  mailMode: "archive" | "inbox";
  unreadCounts: Record<string, number>;
}) {
  if (mailMode === "archive") return archivedCount;
  return unreadCounts[accountFilter] ?? 0;
}
