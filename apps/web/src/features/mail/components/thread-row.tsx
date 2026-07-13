import { Archive, Pin } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";
import * as ContextMenu from "@rodge-mail/ui-web/context-menu";

import type { MailRouteSearch } from "../mail-route-search";
import type { MailAccountFilter } from "../store";
import type { InboxMessage, MailAccountView } from "../types";
import { QuickLink } from "~/components/quick-link";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { getUnreadThreadRowClass } from "../thread-row-presentation";
import { ThreadRowContent } from "./thread-row-content";

export function ThreadRow({
  message,
  position,
}: {
  message: InboxMessage;
  position: number;
}) {
  const {
    accounts,
    markMessageRead,
    archiveThread,
    mailMode,
    selectedThreadId,
    togglePinned,
  } = useLiveMail();
  const account = accounts.find((item) => item._id === message.accountId);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const bulkSelectedThreadIds = useMailStore(
    (store) => store.bulkSelectedThreadIds,
  );
  const bulkSelectionIsActive = useMailStore(
    (store) => store.bulkSelectionIsActive,
  );
  const toggleBulkThread = useMailStore((store) => store.toggleBulkThread);
  const unreadOnly = useMailStore((store) => store.unreadOnly);
  const isSelected = selectedThreadId === message.threadId;
  const isBulkSelected = bulkSelectedThreadIds.has(message.threadId);
  const rowIsSelected = getRowIsSelected({
    bulkSelectionIsActive,
    isBulkSelected,
    isSelected,
  });
  const senderName = getSenderName(message);
  const pinLabel = message.isPinned ? "Unpin message" : "Pin message";
  const preview = message.classification?.summary ?? message.snippet;
  return (
    <ContextMenu.Container>
      <article
        aria-posinset={position}
        aria-setsize={-1}
        className={cn(
          "mail-thread-row group relative overflow-hidden border-b border-[var(--mail-seam)] bg-[var(--mail-paper)] transition-[background-color,border-color,box-shadow] duration-150",
          getUnreadThreadRowClass(message.isRead, rowIsSelected),
          rowIsSelected
            ? "z-[1] border-y border-[var(--mail-border-strong)] bg-[var(--mail-selected)] shadow-[var(--warm-shadow-raised)]"
            : "hover:bg-[var(--mail-row-hover)]",
        )}
      >
        <SelectedMarker selected={rowIsSelected} />
        <ThreadRowTarget
          account={account}
          accountFilter={accountFilter}
          bulkSelectionIsActive={bulkSelectionIsActive}
          isBulkSelected={isBulkSelected}
          mailMode={mailMode}
          markMessageRead={markMessageRead}
          message={message}
          preview={preview}
          senderName={senderName}
          toggleBulkThread={toggleBulkThread}
          unreadOnly={unreadOnly}
        />
        <ThreadRowActions
          archiveThread={archiveThread}
          bulkSelectionIsActive={bulkSelectionIsActive}
          mailMode={mailMode}
          message={message}
          pinLabel={pinLabel}
          togglePinned={togglePinned}
        />
      </article>
    </ContextMenu.Container>
  );
}

function ThreadRowTarget({
  account,
  accountFilter,
  bulkSelectionIsActive,
  isBulkSelected,
  mailMode,
  markMessageRead,
  message,
  preview,
  senderName,
  toggleBulkThread,
  unreadOnly,
}: {
  account: MailAccountView | undefined;
  accountFilter: MailAccountFilter;
  bulkSelectionIsActive: boolean;
  isBulkSelected: boolean;
  mailMode: "archive" | "inbox";
  markMessageRead: (message: InboxMessage) => void;
  message: InboxMessage;
  preview: string;
  senderName: string;
  toggleBulkThread: (threadId: InboxMessage["threadId"]) => void;
  unreadOnly: boolean;
}) {
  if (bulkSelectionIsActive) {
    return (
      <button
        aria-label={getBulkSelectionLabel(isBulkSelected, message.subject)}
        aria-pressed={isBulkSelected}
        className="block w-full px-4 py-3.5 text-left"
        onClick={() => toggleBulkThread(message.threadId)}
        type="button"
      >
        <ThreadRowContent
          account={account}
          isBulkSelected={isBulkSelected}
          message={message}
          preview={preview}
          senderName={senderName}
          showSelection={true}
        />
      </button>
    );
  }
  return (
    <ContextMenu.Trigger asChild>
      <ThreadLink
        accountFilter={accountFilter}
        mailMode={mailMode}
        message={message}
        onClick={() => markMessageRead(message)}
        unreadOnly={unreadOnly}
      >
        <ThreadRowContent
          account={account}
          isBulkSelected={false}
          message={message}
          preview={preview}
          senderName={senderName}
          showSelection={false}
        />
      </ThreadLink>
    </ContextMenu.Trigger>
  );
}

function ThreadRowActions({
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
  pinLabel,
  togglePinned,
}: {
  archiveThread: (message: Pick<InboxMessage, "threadId">) => Promise<void>;
  mailMode: "archive" | "inbox";
  message: InboxMessage;
  pinLabel: string;
  togglePinned: (message: InboxMessage) => Promise<void>;
}) {
  if (mailMode === "archive") return null;
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

function ThreadLink({
  accountFilter,
  children,
  mailMode,
  message,
  onClick,
  unreadOnly,
}: {
  accountFilter: MailAccountFilter;
  children: React.ReactNode;
  mailMode: "archive" | "inbox";
  message: InboxMessage;
  onClick: () => void;
  unreadOnly: boolean;
}) {
  const search = {
    mailbox: accountFilter === "all" ? undefined : accountFilter,
    unread: unreadOnly ? true : undefined,
  } satisfies MailRouteSearch;
  const props = {
    children,
    className: "block w-full px-4 py-3.5 text-left",
    onClick,
    params: { messageId: message._id },
    preload: "intent" as const,
    search,
  };
  if (mailMode === "archive") {
    return <QuickLink {...props} to="/archive/messages/$messageId" />;
  }
  return <QuickLink {...props} to="/messages/$messageId" />;
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
    <ContextMenu.Content className="mail-workspace text-foreground rounded-[10px] border border-[var(--mail-seam)] p-1.5 shadow-[var(--mail-shadow-ambient)]">
      <ContextMenu.Item
        className="data-[highlighted]:text-foreground rounded-[7px] data-[highlighted]:bg-[var(--mail-paper-soft)]"
        onSelect={() => void togglePinned(message)}
      >
        <Pin className="size-3.5" />
        {pinLabel}
      </ContextMenu.Item>
      <ContextMenu.Separator className="bg-[var(--mail-seam)]" />
      <ContextMenu.Item
        className="rounded-[7px] text-[var(--mail-highlight)] data-[highlighted]:bg-[var(--mail-paper-soft)] data-[highlighted]:text-[var(--mail-highlight)]"
        onSelect={() => void archiveThread(message)}
      >
        <Archive className="size-3.5" />
        Archive
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
      className="absolute right-3 bottom-2.5 flex size-8 items-center justify-center rounded-lg border border-[var(--mail-seam)] bg-[var(--mail-paper-soft)] text-[var(--mail-ink-soft)] opacity-0 shadow-[var(--mail-shadow-raised)] transition-[color,opacity] group-focus-within:opacity-100 group-hover:opacity-100 hover:text-[var(--mail-highlight)] focus:opacity-100"
      onClick={() => void togglePinned(message)}
      type="button"
    >
      <Pin className="size-3.5" />
    </button>
  );
}

function getSenderName(message: InboxMessage) {
  const name = message.from.name?.trim();
  if (name) return name;
  return message.from.address;
}

function SelectedMarker({ selected }: { selected: boolean }) {
  if (!selected) return null;
  return (
    <span className="absolute inset-y-3 left-0 w-[3px] rounded-r bg-[var(--mail-highlight)]" />
  );
}

function getRowIsSelected({
  bulkSelectionIsActive,
  isBulkSelected,
  isSelected,
}: {
  bulkSelectionIsActive: boolean;
  isBulkSelected: boolean;
  isSelected: boolean;
}) {
  if (bulkSelectionIsActive) return isBulkSelected;
  return isSelected;
}

function getBulkSelectionLabel(isSelected: boolean, subject: string) {
  return `${isSelected ? "Deselect" : "Select"} ${subject}`;
}
