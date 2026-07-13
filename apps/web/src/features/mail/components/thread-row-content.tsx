import { Check, Paperclip, Pin } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { InboxMessage } from "../types";
import { formatInboxDate, getInitials } from "../format";
import { isThreadUnread } from "../thread-row-presentation";

export function ThreadRowContent({
  isBulkSelected,
  message,
  preview,
  senderName,
  showSelection,
}: {
  isBulkSelected: boolean;
  message: InboxMessage;
  preview: string;
  senderName: string;
  showSelection: boolean;
}) {
  return (
    <div className="flex min-h-[76px] items-center gap-3">
      <ThreadRowLeading
        isRead={message.isRead}
        name={senderName}
        selected={isBulkSelected}
        showSelection={showSelection}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-foreground min-w-0 flex-1 truncate text-[13px] font-semibold">
            {senderName}
          </p>
          <ThreadMetadata message={message} />
          <time className="mail-label shrink-0 font-mono text-[9px] tabular-nums">
            {formatInboxDate(new Date(message.receivedAt).toISOString())}
          </time>
        </div>
        <p className="text-foreground/90 mt-0.5 truncate font-serif text-[16px] leading-5 tracking-[-0.01em]">
          {message.subject}
        </p>
        <p className="mail-label mt-0.5 line-clamp-2 pr-9 text-[12px] leading-[1.45]">
          {preview}
        </p>
      </div>
    </div>
  );
}

function ThreadRowLeading({
  isRead,
  name,
  selected,
  showSelection,
}: {
  isRead: boolean;
  name: string;
  selected: boolean;
  showSelection: boolean;
}) {
  if (showSelection) return <ThreadSelectionMarker selected={selected} />;
  return <SenderAvatar isRead={isRead} name={name} />;
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
    <div className="flex shrink-0 items-center gap-1.5">
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

function AttachmentMarker({ hasAttachments }: { hasAttachments: boolean }) {
  if (!hasAttachments) return null;
  return <Paperclip className="size-3 text-[var(--mail-ink-soft)]" />;
}

function SenderAvatar({ isRead, name }: { isRead: boolean; name: string }) {
  return (
    <div className="relative flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--mail-seam)] bg-[var(--mail-avatar)] font-mono text-[10px] font-semibold text-[var(--mail-avatar-foreground)] shadow-[var(--mail-shadow-raised)]">
      {getInitials(name)}
      <UnreadDot isRead={isRead} />
    </div>
  );
}

function UnreadDot({ isRead }: { isRead: boolean }) {
  if (!isThreadUnread(isRead)) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--mail-paper)] bg-[var(--mail-brass-deep)]"
    />
  );
}
