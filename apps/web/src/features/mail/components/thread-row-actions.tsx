import { Archive, Inbox, Pin } from "lucide-react";

import { canMoveMailThreadToInbox } from "@rodge-mail/features/mail";
import * as ContextMenu from "@rodge-mail/ui-web/context-menu";

import type { MailMode } from "../live-data-types";
import type { InboxMessage } from "../types";

export function ThreadRowActions({
  bulkSelectionIsActive,
  ...props
}: React.ComponentProps<typeof InboxThreadActions> & {
  bulkSelectionIsActive: boolean;
}) {
  if (bulkSelectionIsActive) return null;
  return <InboxThreadActions {...props} />;
}

function InboxThreadActions({
  archiveThread,
  mailMode,
  message,
  moveThreadToInbox,
  pinLabel,
  togglePinned,
}: {
  archiveThread: (message: Pick<InboxMessage, "threadId">) => Promise<void>;
  mailMode: MailMode;
  message: InboxMessage;
  moveThreadToInbox: (message: Pick<InboxMessage, "threadId">) => void;
  pinLabel: string;
  togglePinned: (message: InboxMessage) => Promise<void>;
}) {
  if (mailMode === "archive") return null;
  if (message.location.kind !== "inbox") {
    return (
      <MoveToInboxMenu
        message={message}
        moveThreadToInbox={moveThreadToInbox}
      />
    );
  }
  return (
    <>
      <PinMessageButton message={message} togglePinned={togglePinned} />
      <ThreadRowMenu
        message={message}
        pinLabel={pinLabel}
        archiveThread={archiveThread}
        togglePinned={togglePinned}
      />
    </>
  );
}

function ThreadRowMenu({
  message,
  pinLabel,
  archiveThread,
  togglePinned,
}: {
  message: InboxMessage;
  pinLabel: string;
  archiveThread: (message: Pick<InboxMessage, "threadId">) => Promise<void>;
  togglePinned: (message: InboxMessage) => Promise<void>;
}) {
  return (
    <ContextMenu.Content className="rounded-[10px] p-1.5">
      <ContextMenu.Item
        className="data-[highlighted]:text-foreground data-[highlighted]:bg-accent rounded-[7px]"
        onSelect={() => void togglePinned(message)}
      >
        <Pin className="size-3.5" />
        {pinLabel}
      </ContextMenu.Item>
      <ContextMenu.Separator className="bg-border" />
      <ContextMenu.Item
        className="data-[highlighted]:text-foreground data-[highlighted]:bg-accent rounded-[7px]"
        onSelect={() => void archiveThread(message)}
      >
        <Archive className="size-3.5" />
        Archive
      </ContextMenu.Item>
    </ContextMenu.Content>
  );
}

function MoveToInboxMenu({
  message,
  moveThreadToInbox,
}: {
  message: InboxMessage;
  moveThreadToInbox: (message: Pick<InboxMessage, "threadId">) => void;
}) {
  const canMove = canMoveMailThreadToInbox({
    archivedAt: message.archivedAt,
    inInbox: false,
    provider: message.account.provider,
  });
  if (!canMove) return null;
  return (
    <ContextMenu.Content className="rounded-[10px] p-1.5">
      <ContextMenu.Item
        className="data-[highlighted]:text-foreground data-[highlighted]:bg-accent rounded-[7px]"
        onSelect={() => moveThreadToInbox(message)}
      >
        <Inbox className="size-3.5" />
        Move to Inbox
      </ContextMenu.Item>
    </ContextMenu.Content>
  );
}

function PinMessageButton({
  message,
  togglePinned,
}: {
  message: InboxMessage;
  togglePinned: (message: InboxMessage) => Promise<void>;
}) {
  return (
    <button
      aria-label={message.isPinned ? "Unpin message" : "Pin message"}
      className="border-border bg-muted text-muted-foreground hover:text-foreground absolute right-3 bottom-2.5 flex size-8 items-center justify-center rounded-lg border opacity-0 transition-[color,opacity] group-focus-within:opacity-100 group-hover:opacity-100 focus:opacity-100"
      onClick={() => void togglePinned(message)}
      type="button"
    >
      <Pin className="size-3.5" />
    </button>
  );
}
