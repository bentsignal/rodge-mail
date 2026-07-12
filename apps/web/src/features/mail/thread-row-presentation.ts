export function getUnreadThreadRowClass(isRead: boolean, isSelected: boolean) {
  if (isRead || isSelected) return undefined;
  return "mail-thread-row-unread";
}
