import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCheck,
  Inbox,
  MailOpen,
  MailX,
  Pin,
  Reply,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { MailThreadPlacement } from "@rodge-mail/features/mail";

import type { MailMode } from "../live-data-types";
import type { ThreadMessageDetail } from "../types";
import { ArchiveDeleteDialog } from "./reader-delete-dialog";
import {
  getUnsubscribeDialogMessage,
  ReaderUnsubscribeDialog,
} from "./reader-unsubscribe-dialog";

interface ReaderToolbarProps {
  archiveThread: (message: ThreadMessageDetail) => Promise<void>;
  canMoveToInbox: boolean;
  closeMobileReader: () => void;
  mailMode: MailMode;
  markNotSpam: (message: ThreadMessageDetail) => Promise<void>;
  moveToInbox: (message: ThreadMessageDetail) => void;
  placement: MailThreadPlacement;
  permanentlyDeleteArchivedThread: (
    message: ThreadMessageDetail,
  ) => Promise<void>;
  replyToSelectedThread: () => void;
  restoreArchivedThread: (message: ThreadMessageDetail) => Promise<void>;
  selectedMessage: ThreadMessageDetail | undefined;
  togglePinned: (message: ThreadMessageDetail) => Promise<void>;
  toggleRead: (message: ThreadMessageDetail) => Promise<void>;
  unsubscribe: (message: ThreadMessageDetail) => Promise<void>;
}

export function ReaderToolbar(props: ReaderToolbarProps) {
  const [deleteIsOpen, setDeleteIsOpen] = useState(false);
  const [unsubscribeIsOpen, setUnsubscribeIsOpen] = useState(false);
  return (
    <>
      <header className="bg-muted border-border relative z-[3] flex h-16 shrink-0 items-center gap-1 border-b px-4 sm:px-6">
        <ReaderIconButton
          className="lg:hidden"
          icon={ArrowLeft}
          label="Back to inbox"
          onClick={props.closeMobileReader}
        />
        <div className="bg-border mx-1 h-5 w-px lg:hidden" />
        <ReaderModeActions
          {...props}
          requestDelete={() => setDeleteIsOpen(true)}
          requestUnsubscribe={() => setUnsubscribeIsOpen(true)}
        />
        <button
          className="mail-primary-button ml-auto flex h-11 items-center gap-2 rounded-lg px-4 text-xs font-bold transition-colors"
          onClick={props.replyToSelectedThread}
          type="button"
        >
          <Reply className="size-3.5" />
          Reply
        </button>
      </header>
      <ArchiveDeleteDialog
        message={getDeleteMessage(deleteIsOpen, props.selectedMessage)}
        onOpenChange={setDeleteIsOpen}
        permanentlyDelete={props.permanentlyDeleteArchivedThread}
      />
      <ReaderUnsubscribeDialog
        message={getUnsubscribeDialogMessage(
          unsubscribeIsOpen,
          props.selectedMessage,
        )}
        onOpenChange={setUnsubscribeIsOpen}
        unsubscribe={props.unsubscribe}
      />
    </>
  );
}

function getDeleteMessage(
  deleteIsOpen: boolean,
  selectedMessage: ThreadMessageDetail | undefined,
) {
  if (!deleteIsOpen) return undefined;
  return selectedMessage;
}

function ReaderModeActions({
  archiveThread,
  canMoveToInbox,
  mailMode,
  markNotSpam,
  moveToInbox,
  placement,
  requestDelete,
  restoreArchivedThread,
  selectedMessage,
  togglePinned,
  toggleRead,
  requestUnsubscribe,
}: ReaderToolbarProps & {
  requestDelete: () => void;
  requestUnsubscribe: () => void;
}) {
  if (mailMode === "spam") {
    return (
      <ReaderIconButton
        icon={ShieldCheck}
        label="Not spam"
        onClick={
          selectedMessage ? () => void markNotSpam(selectedMessage) : undefined
        }
      />
    );
  }
  if (mailMode === "archive") {
    return (
      <>
        <ReaderIconButton
          icon={ArchiveRestore}
          label="Restore to inbox"
          onClick={
            selectedMessage
              ? () => void restoreArchivedThread(selectedMessage)
              : undefined
          }
        />
        <ReaderIconButton
          icon={Trash2}
          label="Delete permanently"
          onClick={selectedMessage ? requestDelete : undefined}
        />
      </>
    );
  }
  if (placement !== "inbox") {
    return (
      <>
        <MoveToInboxReaderAction
          canMoveToInbox={canMoveToInbox}
          message={selectedMessage}
          moveToInbox={moveToInbox}
        />
        <ReadReaderAction message={selectedMessage} toggleRead={toggleRead} />
      </>
    );
  }
  return (
    <>
      <UnsubscribeReaderAction
        message={selectedMessage}
        requestUnsubscribe={requestUnsubscribe}
      />
      <PinReaderAction message={selectedMessage} togglePinned={togglePinned} />
      <ReadReaderAction message={selectedMessage} toggleRead={toggleRead} />
      <ArchiveReaderAction
        archiveThread={archiveThread}
        message={selectedMessage}
      />
    </>
  );
}

function UnsubscribeReaderAction({
  message,
  requestUnsubscribe,
}: {
  message: ThreadMessageDetail | undefined;
  requestUnsubscribe: () => void;
}) {
  if (!message?.mailingList) return null;
  return (
    <ReaderIconButton
      icon={MailX}
      label={`Unsubscribe from ${message.mailingList.displayName}`}
      onClick={requestUnsubscribe}
    />
  );
}

function MoveToInboxReaderAction({
  canMoveToInbox,
  message,
  moveToInbox,
}: {
  canMoveToInbox: boolean;
  message: ThreadMessageDetail | undefined;
  moveToInbox: (message: ThreadMessageDetail) => void;
}) {
  if (!canMoveToInbox) return null;
  return (
    <ReaderIconButton
      icon={Inbox}
      label="Move to Inbox"
      onClick={message ? () => moveToInbox(message) : undefined}
    />
  );
}

function ArchiveReaderAction({
  archiveThread,
  message,
}: {
  archiveThread: (message: ThreadMessageDetail) => Promise<void>;
  message: ThreadMessageDetail | undefined;
}) {
  return (
    <ReaderIconButton
      icon={Archive}
      label="Archive (provider copy stays unchanged)"
      onClick={message ? () => void archiveThread(message) : undefined}
    />
  );
}

function PinReaderAction({
  message,
  togglePinned,
}: {
  message: ThreadMessageDetail | undefined;
  togglePinned: (message: ThreadMessageDetail) => Promise<void>;
}) {
  if (!message) return <ReaderIconButton icon={Pin} label="Pin message" />;
  return (
    <ReaderIconButton
      active={message.isPinned}
      icon={Pin}
      label={message.isPinned ? "Unpin message" : "Pin message"}
      onClick={() => void togglePinned(message)}
    />
  );
}

function ReadReaderAction({
  message,
  toggleRead,
}: {
  message: ThreadMessageDetail | undefined;
  toggleRead: (message: ThreadMessageDetail) => Promise<void>;
}) {
  if (!message) return <ReaderIconButton icon={CheckCheck} label="Mark read" />;
  return (
    <ReaderIconButton
      icon={message.isRead ? MailOpen : CheckCheck}
      label={message.isRead ? "Mark unread" : "Mark read"}
      onClick={() => void toggleRead(message)}
    />
  );
}

function ReaderIconButton({
  active,
  className,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  className?: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "mail-icon-button flex size-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-accent text-foreground",
        className,
      )}
      disabled={!onClick}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className={cn("size-4", active && "fill-current")} />
    </button>
  );
}
