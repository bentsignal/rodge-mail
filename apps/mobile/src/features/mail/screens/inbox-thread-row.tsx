import type { MailThread } from "@rodge-mail/features/mail";

import type { useInboxMailboxControls } from "./use-inbox-mailbox-controls";
import { ThreadRow } from "../components/thread-row";
import { getThreadTag } from "../components/thread-row-presentation";
import { useMailStore } from "../store";

export function InboxThreadRow({
  controls,
  isSearch,
  onMoveToInbox,
  onOpen,
  thread,
}: {
  controls: ReturnType<typeof useInboxMailboxControls>;
  isSearch: boolean;
  onMoveToInbox: (threadId: string) => void;
  onOpen: (threadId: string) => void;
  thread: MailThread;
}) {
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  return (
    <ThreadRow
      locationTag={
        isSearch
          ? getThreadTag({ accountFilter, accounts, isSearch, thread })
          : undefined
      }
      onMoveToInbox={() => onMoveToInbox(thread.id)}
      selected={controls.selectedIds.has(thread.id)}
      selectionMode={controls.selectionMode}
      thread={thread}
      onOpen={() => onOpen(thread.id)}
      onSelect={() => controls.toggleThreadSelection(thread.id)}
    />
  );
}
