import { Check, Paperclip, Pin } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { InboxMessage, MailAccountView } from "../types";
import { formatInboxDate, getInitials } from "../format";

export function ThreadRowContent({
  account,
  isBulkSelected,
  message,
  preview,
  senderName,
  showSelection,
}: {
  account: MailAccountView | undefined;
  isBulkSelected: boolean;
  message: InboxMessage;
  preview: string;
  senderName: string;
  showSelection: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <ThreadRowLeading
        account={account}
        name={senderName}
        selected={isBulkSelected}
        showSelection={showSelection}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className={getSenderClass(message.isRead)}>{senderName}</p>
          <time className="mail-label shrink-0 font-mono text-[9px] tabular-nums">
            {formatInboxDate(new Date(message.receivedAt).toISOString())}
          </time>
        </div>
        <p className={getSubjectClass(message.isRead)}>{message.subject}</p>
        <p className="mail-label mt-0.5 line-clamp-2 text-[12px] leading-[1.45]">
          {preview}
        </p>
        <ThreadMetadata message={message} />
      </div>
    </div>
  );
}

function ThreadRowLeading({
  account,
  name,
  selected,
  showSelection,
}: {
  account: MailAccountView | undefined;
  name: string;
  selected: boolean;
  showSelection: boolean;
}) {
  if (showSelection) return <ThreadSelectionMarker selected={selected} />;
  return <SenderAvatar account={account} name={name} />;
}

function ThreadSelectionMarker({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[10px] border transition-colors",
        selected
          ? "border-[var(--mail-brass-deep)] bg-[var(--mail-brass)] text-[#21190a] shadow-[var(--mail-shadow-raised)]"
          : "mail-inset border-[var(--mail-seam)] text-transparent",
      )}
    >
      <Check className="size-4" strokeWidth={2.5} />
    </span>
  );
}

function ThreadMetadata({ message }: { message: InboxMessage }) {
  return (
    <div className="mt-1.5 flex min-h-4 items-center gap-2">
      <UnreadMarker isRead={message.isRead} />
      <PinnedMarker isPinned={message.isPinned} />
      <AttachmentMarker hasAttachments={message.hasAttachments} />
    </div>
  );
}

function PinnedMarker({ isPinned }: { isPinned: boolean }) {
  if (!isPinned) return null;
  return (
    <Pin
      aria-label="Pinned"
      className="size-3 fill-current text-[var(--mail-highlight)]"
    />
  );
}

function UnreadMarker({ isRead }: { isRead: boolean }) {
  if (isRead) return null;
  return (
    <span
      aria-label="Unread message"
      className="flex h-4 items-center rounded-[4px] border border-[var(--mail-brass-deep)] bg-[color-mix(in_oklab,var(--mail-brass)_14%,transparent)] px-1.5 font-mono text-[8px] font-bold tracking-[0.08em] text-[var(--mail-brass-deep)] uppercase"
    >
      <span aria-hidden="true">Unread</span>
    </span>
  );
}

function AttachmentMarker({ hasAttachments }: { hasAttachments: boolean }) {
  if (!hasAttachments) return null;
  return <Paperclip className="size-3 text-[var(--mail-ink-soft)]" />;
}

function SenderAvatar({
  account,
  name,
}: {
  account: MailAccountView | undefined;
  name: string;
}) {
  return (
    <div className="relative flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--mail-seam)] bg-[var(--mail-avatar)] font-mono text-[10px] font-semibold text-[var(--mail-avatar-foreground)] shadow-[var(--mail-shadow-raised)]">
      {getInitials(name)}
      <AccountDot accent={account?.accent} />
    </div>
  );
}

function AccountDot({ accent }: { accent: string | undefined }) {
  if (!accent) return null;
  return (
    <span
      className="absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-[var(--mail-paper-soft)]"
      style={{ backgroundColor: accent }}
    />
  );
}

function getSenderClass(isRead: boolean) {
  return cn(
    "min-w-0 flex-1 truncate text-[13px]",
    isRead ? "font-medium" : "text-foreground font-bold",
  );
}

function getSubjectClass(isRead: boolean) {
  return cn(
    "mt-0.5 truncate font-serif text-[16px] leading-5 tracking-[-0.01em]",
    isRead ? "text-foreground/80" : "font-semibold",
  );
}
