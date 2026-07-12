export function matchesUnreadScope(
  unreadOnly: boolean | undefined,
  item: { isRead: boolean },
) {
  return !unreadOnly || !item.isRead;
}

export function matchesUnreadThreadScope(
  unreadOnly: boolean | undefined,
  thread: { unreadCount: number },
) {
  return !unreadOnly || thread.unreadCount > 0;
}
