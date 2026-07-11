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
    selectedMessageId,
    togglePinned,
  } = useLiveMail();
  const account = accounts.find((item) => item._id === message.accountId);
  const isSelected = selectedMessageId === message._id;
  const senderName = getSenderName(message);
  const pinLabel = message.isPinned ? "Unpin message" : "Pin message";
  const preview = message.classification?.summary ?? message.snippet;

  return (
    <ContextMenu.Container>
      <article
        aria-posinset={position}
        aria-setsize={-1}
        className={cn(
          "group border-border relative border-b transition-colors",
          isSelected
            ? "bg-[var(--mail-selected)]"
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
                  <time className="shrink-0 font-mono text-[9px] text-[#978b7e] tabular-nums">
                    {formatInboxDate(
                      new Date(message.receivedAt).toISOString(),
                    )}
                  </time>
                </div>
                <p
                  className={cn(
                    "mt-1 truncate font-serif text-[16px] leading-5 tracking-[-0.01em]",
                    message.isRead
                      ? "text-[#514b44] dark:text-[#cec6ba]"
                      : "font-semibold",
                  )}
                >
                  {message.subject}
                </p>
                <p className="mt-1 line-clamp-2 text-[12px] leading-[1.55] text-[#81766a] dark:text-[#aaa095]">
                  {preview}
                </p>
                <ThreadMetadata message={message} />
              </div>
            </div>
          </QuickLink>
        </ContextMenu.Trigger>
        <PinMessageButton message={message} togglePinned={togglePinned} />
        <ContextMenu.Content>
          <ContextMenu.Item onSelect={() => void togglePinned(message)}>
            <Pin className="size-3.5" />
            {pinLabel}
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item
            className="text-[#ad533a] dark:text-[#e58b6d]"
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
  return <Paperclip className="size-3 text-[#998c7e]" />;
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
          : "text-[#a99d90] opacity-0 group-hover:opacity-100 focus:opacity-100",
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
    <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-[var(--mail-avatar)] font-mono text-[10px] font-semibold text-[var(--mail-avatar-foreground)]">
      {getInitials(name)}
      <span
        className="ring-card absolute right-0 bottom-0 size-2.5 rounded-full ring-2"
        style={{ backgroundColor: account?.accent }}
      />
    </div>
  );
}
