import type { MailThread } from "@rodge-mail/features/mail";

import type { useInboxMailboxControls } from "./use-inbox-mailbox-controls";
import { ThreadRow } from "../components/thread-row";

export function InboxThreadRow({
  controls,
  onOpen,
  thread,
}: {
  controls: ReturnType<typeof useInboxMailboxControls>;
  onOpen: (threadId: string) => void;
  thread: MailThread;
}) {
  return (
    <ThreadRow
      selected={controls.selectedIds.has(thread.id)}
      selectionMode={controls.selectionMode}
      thread={thread}
      onOpen={() => onOpen(thread.id)}
      onSelect={() => controls.toggleThreadSelection(thread.id)}
    />
  );
}
