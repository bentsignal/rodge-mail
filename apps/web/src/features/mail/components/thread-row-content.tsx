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
  tag,
}: {
  isBulkSelected: boolean;
  message: InboxMessage;
  preview: string;
  senderName: string;
  showSelection: boolean;
  tag: string | undefined;
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
          <LocationTag tag={tag} />
          <ThreadMetadata message={message} />
          <time className="mail-label shrink-0 text-[11px] font-medium tabular-nums">
            {formatInboxDate(new Date(message.receivedAt).toISOString())}
          </time>
        </div>
        <p className="text-foreground/90 mt-0.5 truncate text-[16px] leading-5 tracking-[-0.01em]">
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
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-muted border-border text-transparent",
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

function LocationTag({ tag }: { tag: string | undefined }) {
  if (!tag) return null;
  return (
    <span className="border-border text-muted-foreground max-w-[45%] shrink truncate rounded-[5px] border px-1.5 text-[10px] leading-4 font-medium">
      {tag}
    </span>
  );
}

function PinnedMarker({ isPinned }: { isPinned: boolean }) {
  if (!isPinned) return null;
  return (
    <Pin aria-label="Pinned" className="text-foreground size-3 fill-current" />
  );
}

function AttachmentMarker({ hasAttachments }: { hasAttachments: boolean }) {
  if (!hasAttachments) return null;
  return <Paperclip className="text-muted-foreground size-3" />;
}

function SenderAvatar({ isRead, name }: { isRead: boolean; name: string }) {
  return (
    <div className="border-border bg-muted text-foreground relative flex size-8 shrink-0 items-center justify-center rounded-[10px] border text-[11px] font-semibold">
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
      className="border-background bg-foreground absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2"
    />
  );
}
