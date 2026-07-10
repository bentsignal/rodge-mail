import { Inbox, Paperclip, Pin } from "lucide-react";

import type { MailAccount, MailThread } from "@rodge-mail/features/mail";
import { cn } from "@rodge-mail/std/cn";

import { formatInboxDate, getInitials } from "../format";
import { useMailStore } from "../store";

export function ThreadList() {
  const searchQuery = useMailStore((store) => store.searchQuery);
  const visibleThreads = useMailStore((store) => store.visibleThreads);

  if (visibleThreads.length === 0) {
    return <EmptyThreadList isSearch={searchQuery.length > 0} />;
  }

  return (
    <div className="mail-scrollbar min-h-0 flex-1 overflow-y-auto">
      {visibleThreads.map((thread, index) => (
        <ThreadRow index={index} key={thread.id} thread={thread} />
      ))}
      <ThreadListEnd />
    </div>
  );
}

function EmptyThreadList({ isSearch }: { isSearch: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full border border-dashed border-[#bfb4a5] text-[#978a7d]">
        <Inbox className="size-5" strokeWidth={1.5} />
      </span>
      <p className="font-serif text-lg font-semibold">Nothing on the desk</p>
      <p className="mt-1 max-w-xs text-sm leading-6 text-[#887d70]">
        {getEmptyDescription(isSearch)}
      </p>
    </div>
  );
}

function getEmptyDescription(isSearch: boolean) {
  if (isSearch) return "Try a sender, subject, or phrase from the message.";
  return "This view is clear. New mail will settle here when it arrives.";
}

function ThreadListEnd() {
  return (
    <div className="flex items-center gap-3 px-6 py-7 text-[#9b9185]">
      <span className="h-px flex-1 bg-[#dfd7cb] dark:bg-[#3d413b]" />
      <span className="font-mono text-[8px] tracking-[0.18em] uppercase">
        End of view
      </span>
      <span className="h-px flex-1 bg-[#dfd7cb] dark:bg-[#3d413b]" />
    </div>
  );
}

function ThreadRow({ index, thread }: { index: number; thread: MailThread }) {
  const accounts = useMailStore((store) => store.accounts);
  const selectedThreadId = useMailStore((store) => store.selectedThread?.id);
  const selectThread = useMailStore((store) => store.selectThread);
  const togglePinned = useMailStore((store) => store.togglePinned);
  const account = accounts.find((item) => item.id === thread.accountId);
  const isSelected = selectedThreadId === thread.id;

  return (
    <article
      className={cn(
        "group relative border-b border-[#e2dacd] transition dark:border-[#373b35]",
        isSelected
          ? "bg-[#f0e9dc] dark:bg-[#30342e]"
          : "hover:bg-[#faf7f0] dark:hover:bg-white/[0.025]",
      )}
      style={{ animationDelay: `${Math.min(index * 34, 220)}ms` }}
    >
      <SelectedMarker selected={isSelected} />
      <button
        className="w-full px-4 py-4 pr-12 text-left sm:px-5"
        onClick={() => selectThread(thread.id)}
        type="button"
      >
        <div className="flex items-start gap-3">
          <SenderAvatar account={account} name={thread.sender.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-[13px]",
                  thread.isRead ? "font-medium" : "font-bold text-[#1f241f]",
                )}
              >
                {thread.sender.name}
              </p>
              <time className="shrink-0 font-mono text-[9px] text-[#978b7e] tabular-nums">
                {formatInboxDate(thread.receivedAt)}
              </time>
            </div>
            <p
              className={cn(
                "mt-1 truncate font-serif text-[16px] leading-5 tracking-[-0.01em]",
                thread.isRead
                  ? "text-[#514b44] dark:text-[#cec6ba]"
                  : "font-semibold",
              )}
            >
              {thread.subject}
            </p>
            <p className="mt-1 line-clamp-2 text-[12px] leading-[1.55] text-[#81766a] dark:text-[#aaa095]">
              {thread.preview}
            </p>
            <ThreadMetadata thread={thread} />
          </div>
        </div>
      </button>
      <button
        aria-label={thread.isPinned ? "Unpin thread" : "Pin thread"}
        className={cn(
          "absolute right-3 bottom-3 flex size-7 items-center justify-center rounded-full transition",
          thread.isPinned
            ? "text-[#b95d41]"
            : "text-[#a99d90] opacity-0 group-hover:opacity-100 focus:opacity-100",
        )}
        onClick={() => togglePinned(thread.id)}
        type="button"
      >
        <Pin className={cn("size-3.5", thread.isPinned && "fill-current")} />
      </button>
    </article>
  );
}

function ThreadMetadata({ thread }: { thread: MailThread }) {
  const hasAttachments = thread.messages.some(
    (message) => message.attachments.length > 0,
  );

  return (
    <div className="mt-2.5 flex h-4 items-center gap-2">
      <UnreadDot isRead={thread.isRead} />
      <AttachmentIcon visible={hasAttachments} />
      <PriorityNote note={thread.priorityNote} />
    </div>
  );
}

function SelectedMarker({ selected }: { selected: boolean }) {
  if (!selected) return null;
  return (
    <span className="absolute inset-y-3 left-0 w-[3px] rounded-r bg-[#c76749]" />
  );
}

function UnreadDot({ isRead }: { isRead: boolean }) {
  if (isRead) return null;
  return <span className="size-1.5 rounded-full bg-[#c76749]" />;
}

function AttachmentIcon({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <Paperclip className="size-3 text-[#998c7e]" />;
}

function PriorityNote({ note }: { note: string | undefined }) {
  if (!note) return null;
  return (
    <span className="truncate font-mono text-[8px] tracking-[0.08em] text-[#8d725e] uppercase">
      {note}
    </span>
  );
}

function SenderAvatar({
  account,
  name,
}: {
  account: MailAccount | undefined;
  name: string;
}) {
  return (
    <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-[#e7ded0] font-mono text-[10px] font-semibold text-[#625a50] dark:bg-[#3c413a] dark:text-[#e0d7cb]">
      {getInitials(name)}
      <span
        className="ring-card absolute right-0 bottom-0 size-2.5 rounded-full ring-2"
        style={{ backgroundColor: account?.accent }}
      />
    </div>
  );
}
