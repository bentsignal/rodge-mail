import type { MailThread } from "@rodge-mail/features/mail";

export interface ThreadRowProps {
  mailbox?: "archive" | "inbox";
  onDelete?: () => void;
  onOpen: () => void;
  onRestore?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  selectionMode?: boolean;
  thread: MailThread;
}
