import type { MailThread } from "@rodge-mail/features/mail";

import type { MobileMailbox } from "../store";

export interface ThreadRowProps {
  mailbox?: MobileMailbox;
  onDelete?: () => void;
  onOpen: () => void;
  onRestore?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  selectionMode?: boolean;
  thread: MailThread;
}
