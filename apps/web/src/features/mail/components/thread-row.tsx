import { EyeOff, Paperclip, Pin } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";
import * as ContextMenu from "@rodge-mail/ui-web/context-menu";

import type { InboxMessage, MailAccountView } from "../types";
import { QuickLink } from "~/components/quick-link";
import { formatInboxDate, getInitials } from "../format";
import { useLiveMail } from "../live-data";

export function ThreadRow({
  message,
  position,
}: {
  message: InboxMessage;
  position: number;
}) {
  const {
    accounts,
    removeFromRodge,
    selectMessage,
    selectedThreadId,
    togglePinned,
  } = useLiveMail();
  const account = accounts.find((item) => item._id === message.accountId);
  const isSelected = selectedThreadId === message.threadId;
  const senderName = getSenderName(message);
  const pinLabel = message.isPinned ? "Unpin message" : "Pin message";
  const preview = message.classification?.summary ?? message.snippet;

  return (
    <ContextMenu.Container>
      <article
        aria-posinset={position}
        aria-setsize={-1}
        className={cn(
          "group relative border-b border-[var(--mail-seam)] bg-[var(--mail-paper-soft)] transition-colors",
          isSelected
            ? "z-[1] bg-[var(--mail-selected)] shadow-[0_1px_0_rgba(255,255,255,0.48)_inset,0_3px_8px_rgba(57,43,20,0.10)] dark:shadow-[0_1px_0_rgba(255,239,184,0.06)_inset,0_3px_10px_rgba(0,0,0,0.24)]"
            : "hover:bg-[var(--mail-row-hover)]",
        )}
      >
        <SelectedMarker selected={isSelected} />
        <ContextMenu.Trigger asChild>
          <QuickLink
            className="w-full px-4 py-4 pr-12 text-left sm:px-5"
            onClick={() => selectMessage(message)}
            params={{ messageId: message._id }}
            preload="intent"
            to="/messages/$messageId"
          >
            <div className="flex items-start gap-3">
              <SenderAvatar account={account} name={senderName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px]",
                      message.isRead
                        ? "font-medium"
                        : "text-foreground font-bold",
                    )}
                  >
                    {senderName}
                  </p>
                  <time className="mail-label shrink-0 font-mono text-[9px] tabular-nums">
                    {formatInboxDate(
                      new Date(message.receivedAt).toISOString(),
                    )}
                  </time>
                </div>
                <p
                  className={cn(
                    "mt-1 truncate font-serif text-[16px] leading-5 tracking-[-0.01em]",
                    message.isRead ? "text-foreground/80" : "font-semibold",
                  )}
                >
                  {message.subject}
                </p>
                <p className="mail-label mt-1 line-clamp-2 text-[12px] leading-[1.55]">
                  {preview}
                </p>
                <ThreadMetadata message={message} />
              </div>
            </div>
          </QuickLink>
        </ContextMenu.Trigger>
        <PinMessageButton message={message} togglePinned={togglePinned} />
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
            onSelect={() => void removeFromRodge(message)}
          >
            <EyeOff className="size-3.5" />
            Remove from Rodge
          </ContextMenu.Item>
        </ContextMenu.Content>
      </article>
    </ContextMenu.Container>
  );
}

function ThreadMetadata({ message }: { message: InboxMessage }) {
  return (
    <div className="mt-2.5 flex h-4 items-center gap-2">
      <UnreadDot isRead={message.isRead} />
      <AttachmentMarker hasAttachments={message.hasAttachments} />
    </div>
  );
}

function UnreadDot({ isRead }: { isRead: boolean }) {
  if (isRead) return null;
  return <span className="size-1.5 rounded-full bg-[var(--mail-highlight)]" />;
}

function AttachmentMarker({ hasAttachments }: { hasAttachments: boolean }) {
  if (!hasAttachments) return null;
  return <Paperclip className="size-3 text-[var(--mail-ink-soft)]" />;
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
      className={cn(
        "absolute right-3 bottom-3 flex size-7 items-center justify-center rounded-full transition",
        message.isPinned
          ? "text-[var(--mail-highlight)]"
          : "text-[var(--mail-ink-soft)] opacity-0 group-hover:opacity-100 focus:opacity-100",
      )}
      onClick={() => void togglePinned(message)}
      type="button"
    >
      <Pin className={cn("size-3.5", message.isPinned && "fill-current")} />
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

function SenderAvatar({
  account,
  name,
}: {
  account: MailAccountView | undefined;
  name: string;
}) {
  return (
    <div className="relative flex size-9 shrink-0 items-center justify-center rounded-[11px] border border-[var(--mail-seam)] bg-[var(--mail-avatar)] font-mono text-[10px] font-semibold text-[var(--mail-avatar-foreground)] shadow-[var(--mail-shadow-raised)]">
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
