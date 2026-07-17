import type { MailThread } from "@rodge-mail/features/mail";

export function getSenderInitials(sender: string) {
  return sender
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

export function getThreadRowAccessibilityLabel(
  thread: Pick<MailThread, "isPinned" | "isRead" | "sender" | "subject">,
) {
  const state = [
    thread.isRead ? "read" : "unread",
    thread.isPinned ? "pinned" : undefined,
  ].filter(Boolean);

  return `${thread.sender.name}, ${thread.subject}, ${state.join(", ")}`;
}

export function getPinAction(thread: Pick<MailThread, "isPinned">) {
  return thread.isPinned
    ? { label: "Unpin", systemImage: "pin.slash" as const }
    : { label: "Pin", systemImage: "pin" as const };
}

export function getReadAction(thread: Pick<MailThread, "isRead">) {
  return thread.isRead
    ? { label: "Mark Unread", systemImage: "envelope.badge" as const }
    : { label: "Mark Read", systemImage: "envelope.open" as const };
}

export function isThreadUnread(thread: Pick<MailThread, "isRead">) {
  return !thread.isRead;
}

export function getThreadRowNativeKey(
  thread: Pick<MailThread, "id" | "isPinned" | "isRead">,
) {
  return `${thread.id}:${thread.isPinned ? "pinned" : "unpinned"}:${thread.isRead ? "read" : "unread"}`;
}

export function runAfterSwipeAnimation(action: () => void) {
  setTimeout(action, 300);
}
