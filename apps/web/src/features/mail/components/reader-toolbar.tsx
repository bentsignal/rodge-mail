import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCheck,
  MailOpen,
  Pin,
  Reply,
  Trash2,
} from "lucide-react";

import { cn } from "@rodge-mail/std/cn";
import * as Dialog from "@rodge-mail/ui-web/dialog";

import type { ThreadMessageDetail } from "../types";

interface ReaderToolbarProps {
  archiveThread: (message: ThreadMessageDetail) => Promise<void>;
  closeMobileReader: () => void;
  mailMode: "archive" | "inbox";
  permanentlyDeleteArchivedThread: (
    message: ThreadMessageDetail,
  ) => Promise<void>;
  replyToSelectedThread: () => void;
  restoreArchivedThread: (message: ThreadMessageDetail) => Promise<void>;
  selectedMessage: ThreadMessageDetail | undefined;
  togglePinned: (message: ThreadMessageDetail) => Promise<void>;
  toggleRead: (message: ThreadMessageDetail) => Promise<void>;
}

export function ReaderToolbar(props: ReaderToolbarProps) {
  const [deleteIsOpen, setDeleteIsOpen] = useState(false);
  return (
    <>
      <header className="mail-reader-toolbar mail-paper-soft relative z-[3] flex h-16 shrink-0 items-center gap-1 border-b border-[var(--mail-seam)] px-4 sm:px-6">
        <ReaderIconButton
          className="lg:hidden"
          icon={ArrowLeft}
          label="Back to inbox"
          onClick={props.closeMobileReader}
        />
        <div className="mx-1 h-5 w-px bg-[var(--mail-seam)] lg:hidden" />
        <ReaderModeActions
          {...props}
          requestDelete={() => setDeleteIsOpen(true)}
        />
        <button
          className="mail-brass-button ml-auto flex h-11 items-center gap-2 rounded-lg px-4 text-xs font-bold transition-colors"
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
  mailMode,
  requestDelete,
  restoreArchivedThread,
  selectedMessage,
  togglePinned,
  toggleRead,
}: ReaderToolbarProps & { requestDelete: () => void }) {
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
  return (
    <>
      <PinReaderAction message={selectedMessage} togglePinned={togglePinned} />
      <ReadReaderAction message={selectedMessage} toggleRead={toggleRead} />
      <ArchiveReaderAction
        archiveThread={archiveThread}
        message={selectedMessage}
      />
    </>
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

function ArchiveDeleteDialog({
  message,
  onOpenChange,
  permanentlyDelete,
}: {
  message: ThreadMessageDetail | undefined;
  onOpenChange: (open: boolean) => void;
  permanentlyDelete: (message: ThreadMessageDetail) => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  async function confirmDelete() {
    if (!message) return;
    setIsDeleting(true);
    await permanentlyDelete(message);
    setIsDeleting(false);
    onOpenChange(false);
  }
  return (
    <Dialog.Container onOpenChange={onOpenChange} open={message !== undefined}>
      <Dialog.Content className="mail-dialog mail-workspace max-w-md overflow-hidden rounded-[18px] border p-0">
        <div className="mail-chassis border-b p-6">
          <Dialog.Title className="font-serif text-2xl tracking-[-0.03em]">
            Delete permanently?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-5 text-[var(--mail-chassis-foreground)]/70">
            This permanently removes Rodge Mail’s archived copy and cannot be
            undone. Your provider copy is unchanged.
          </Dialog.Description>
        </div>
        <div className="flex justify-end gap-2 p-5">
          <button
            className="mail-raised h-10 rounded-lg border border-[var(--mail-seam)] px-4 text-xs font-semibold"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-lg bg-[var(--mail-highlight)] px-4 text-xs font-bold text-white disabled:opacity-50"
            disabled={isDeleting}
            onClick={() => void confirmDelete()}
            type="button"
          >
            {getDeleteLabel(isDeleting)}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Container>
  );
}

function getDeleteLabel(isDeleting: boolean) {
  if (isDeleting) return "Deleting…";
  return "Delete permanently";
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
        active && "text-[var(--mail-highlight)]",
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
