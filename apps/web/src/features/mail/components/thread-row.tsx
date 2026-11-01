import { cn } from "@rodge-mail/std/cn";
import * as ContextMenu from "@rodge-mail/ui-web/context-menu";

import type { MailMode } from "../live-data-types";
import type { MailRouteSearch } from "../mail-route-search";
import type { MailAccountFilter } from "../store";
import type { InboxMessage } from "../types";
import { QuickLink } from "~/components/quick-link";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import {
  getThreadRowAccessibilityLabel,
  getThreadRowTag,
} from "../thread-row-presentation";
import { ThreadRowActions } from "./thread-row-actions";
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
    moveThreadToInbox,
    archiveThread,
    mailMode,
    selectedThreadId,
    togglePinned,
  } = useLiveMail();
  const accountFilter = useMailStore((store) => store.accountFilter);
  const debouncedSearchQuery = useMailStore(
    (store) => store.debouncedSearchQuery,
  );
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
  const tag = getThreadRowTag({
    accountFilter,
    accounts,
    isSearch: debouncedSearchQuery.length > 0,
    mailMode,
    message,
  });
  return (
    <ContextMenu.Container>
      <article
        aria-posinset={position}
        aria-setsize={-1}
        className={cn(
          "group border-border bg-background relative overflow-hidden border-b transition-[background-color,border-color,box-shadow] duration-150",
          rowIsSelected
            ? "border-input bg-accent z-[1] border-y"
            : "hover:bg-muted",
        )}
      >
        <SelectedMarker selected={rowIsSelected} />
        <ThreadRowTarget
          accountFilter={accountFilter}
          bulkSelectionIsActive={bulkSelectionIsActive}
          isBulkSelected={isBulkSelected}
          mailMode={mailMode}
          markMessageRead={markMessageRead}
          message={message}
          preview={preview}
          senderName={senderName}
          tag={tag}
          toggleBulkThread={toggleBulkThread}
          unreadOnly={unreadOnly}
        />
        <ThreadRowActions
          archiveThread={archiveThread}
          bulkSelectionIsActive={bulkSelectionIsActive}
          mailMode={mailMode}
          message={message}
          moveThreadToInbox={moveThreadToInbox}
          pinLabel={pinLabel}
          togglePinned={togglePinned}
        />
      </article>
    </ContextMenu.Container>
  );
}

function ThreadRowTarget({
  accountFilter,
  bulkSelectionIsActive,
  isBulkSelected,
  mailMode,
  markMessageRead,
  message,
  preview,
  senderName,
  tag,
  toggleBulkThread,
  unreadOnly,
}: {
  accountFilter: MailAccountFilter;
  bulkSelectionIsActive: boolean;
  isBulkSelected: boolean;
  mailMode: MailMode;
  markMessageRead: (message: InboxMessage) => void;
  message: InboxMessage;
  preview: string;
  senderName: string;
  tag: string | undefined;
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
          isBulkSelected={isBulkSelected}
          message={message}
          preview={preview}
          senderName={senderName}
          showSelection={true}
          tag={tag}
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
        senderName={senderName}
        unreadOnly={unreadOnly}
      >
        <ThreadRowContent
          isBulkSelected={false}
          message={message}
          preview={preview}
          senderName={senderName}
          showSelection={false}
          tag={tag}
        />
      </ThreadLink>
    </ContextMenu.Trigger>
  );
}

function ThreadLink({
  accountFilter,
  children,
  mailMode,
  message,
  onClick,
  senderName,
  unreadOnly,
}: {
  accountFilter: MailAccountFilter;
  children: React.ReactNode;
  mailMode: MailMode;
  message: InboxMessage;
  onClick: () => void;
  senderName: string;
  unreadOnly: boolean;
}) {
  const search = {
    mailbox: accountFilter === "all" ? undefined : accountFilter,
    unread: unreadOnly ? true : undefined,
  } satisfies MailRouteSearch;
  const props = {
    "aria-label": getThreadRowAccessibilityLabel({
      isRead: message.isRead,
      senderName,
      subject: message.subject,
    }),
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
  if (mailMode === "spam") {
    return <QuickLink {...props} to="/spam/messages/$messageId" />;
  }
  if (mailMode === "all") {
    return <QuickLink {...props} to="/all/messages/$messageId" />;
  }
  return <QuickLink {...props} to="/messages/$messageId" />;
}

function getSenderName(message: InboxMessage) {
  const name = message.from.name?.trim();
  if (name) return name;
  return message.from.address;
}

function SelectedMarker({ selected }: { selected: boolean }) {
  if (!selected) return null;
  return (
    <span className="bg-foreground absolute inset-y-3 left-0 w-[3px] rounded-r" />
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
