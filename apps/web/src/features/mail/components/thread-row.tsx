import { EyeOff, Paperclip, Pin } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";
import * as ContextMenu from "@rodge-mail/ui-web/context-menu";

import type { InboxMessage, MailAccountView } from "../types";
import { QuickLink } from "~/components/quick-link";
import { formatInboxDate, getInitials } from "../format";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { getUnreadThreadRowClass } from "../thread-row-presentation";

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
    removeFromRodge,
    selectedThreadId,
    togglePinned,
  } = useLiveMail();
  const account = accounts.find((item) => item._id === message.accountId);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const unreadOnly = useMailStore((store) => store.unreadOnly);
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
          "mail-thread-row group relative overflow-hidden border-b border-[var(--mail-seam)] bg-[var(--mail-paper)] transition-[background-color,border-color,box-shadow] duration-150",
          getUnreadThreadRowClass(message.isRead, isSelected),
          isSelected
            ? "z-[1] border-y border-[var(--mail-border-strong)] bg-[var(--mail-selected)] shadow-[var(--warm-shadow-raised)]"
            : "hover:bg-[var(--mail-row-hover)]",
        )}
      >
        <SelectedMarker selected={isSelected} />
        <ContextMenu.Trigger asChild>
          <QuickLink
            className="block w-full px-4 py-3.5 text-left"
            onClick={() => markMessageRead(message)}
            params={{ messageId: message._id }}
            preload="intent"
            search={{
              mailbox: accountFilter === "all" ? undefined : accountFilter,
              unread: unreadOnly ? true : undefined,
            }}
            to="/messages/$messageId"
          >
            <div className="flex items-start gap-2.5">
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
                    "mt-0.5 truncate font-serif text-[16px] leading-5 tracking-[-0.01em]",
                    message.isRead ? "text-foreground/80" : "font-semibold",
                  )}
                >
                  {message.subject}
                </p>
                <p className="mail-label mt-0.5 line-clamp-2 text-[12px] leading-[1.45]">
                  {preview}
                </p>
                <ThreadMetadata message={message} />
              </div>
            </div>
          </QuickLink>
        </ContextMenu.Trigger>
        <PinMessageButton message={message} togglePinned={togglePinned} />
        <ThreadRowMenu
          message={message}
          pinLabel={pinLabel}
          removeFromRodge={removeFromRodge}
          togglePinned={togglePinned}
        />
      </article>
    </ContextMenu.Container>
  );
}

function ThreadRowMenu({
  message,
  pinLabel,
  removeFromRodge,
  togglePinned,
}: {
  message: InboxMessage;
  pinLabel: string;
  removeFromRodge: (message: Pick<InboxMessage, "threadId">) => Promise<void>;
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
        onSelect={() => void removeFromRodge(message)}
      >
        <EyeOff className="size-3.5" />
        Remove from Rodge
      </ContextMenu.Item>
    </ContextMenu.Content>
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
