export function getThreadRowAccessibilityLabel({
  isRead,
  senderName,
  subject,
}: {
  isRead: boolean;
  senderName: string;
  subject: string;
}) {
  return `${senderName}, ${subject}, ${isRead ? "read" : "unread"}`;
}

export function isThreadUnread(isRead: boolean) {
  return !isRead;
}
