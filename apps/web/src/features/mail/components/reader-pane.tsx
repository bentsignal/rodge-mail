import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowLeft,
  CheckCheck,
  Download,
  FileText,
  MailOpen,
  MoreHorizontal,
  Paperclip,
  Pin,
  Reply,
} from "lucide-react";

import type { MailAttachment, MailMessage } from "@rodge-mail/features/mail";
import { cn } from "@rodge-mail/std/cn";

import { formatFullDate, getInitials } from "../format";
import { useMailStore } from "../store";

export function ReaderPane() {
  const mobileReaderIsOpen = useMailStore((store) => store.mobileReaderIsOpen);
  const thread = useMailStore((store) => store.selectedThread);

  if (!thread) {
    return (
      <section
        aria-label="Message reader"
        className="min-w-0 flex-1 flex-col bg-[#fbf8f1] lg:flex dark:bg-[#242823]"
      >
        <EmptyReader />
      </section>
    );
  }

  return (
    <section
      aria-label="Message reader"
      className={cn(
        "min-w-0 flex-1 flex-col bg-[#fbf8f1] dark:bg-[#242823]",
        mobileReaderIsOpen ? "flex" : "hidden lg:flex",
      )}
    >
      <ReaderContent />
    </section>
  );
}

function ReaderContent() {
  const closeMobileReader = useMailStore((store) => store.closeMobileReader);
  const replyToSelectedThread = useMailStore(
    (store) => store.replyToSelectedThread,
  );
  const thread = useMailStore((store) => store.selectedThread);
  const togglePinned = useMailStore((store) => store.togglePinned);
  const toggleRead = useMailStore((store) => store.toggleRead);

  if (!thread) return null;

  return (
    <>
      <header className="border-border/70 flex h-[68px] shrink-0 items-center gap-1 border-b px-3 sm:px-5">
        <ReaderIconButton
          className="lg:hidden"
          icon={ArrowLeft}
          label="Back to inbox"
          onClick={closeMobileReader}
        />
        <div className="mx-1 h-5 w-px bg-[#ded5c8] lg:hidden dark:bg-[#3f433d]" />
        <ReaderIconButton
          active={thread.isPinned}
          icon={Pin}
          label={thread.isPinned ? "Unpin thread" : "Pin thread"}
          onClick={() => togglePinned(thread.id)}
        />
        <ReaderIconButton
          icon={thread.isRead ? MailOpen : CheckCheck}
          label={thread.isRead ? "Mark unread" : "Mark read"}
          onClick={() => toggleRead(thread.id)}
        />
        <ReaderIconButton icon={Archive} label="Archive" />
        <div className="mx-1 h-5 w-px bg-[#ded5c8] dark:bg-[#3f433d]" />
        <ReaderIconButton icon={MoreHorizontal} label="More actions" />
        <button
          className="ml-auto flex h-9 items-center gap-2 rounded-full bg-[#20251f] px-4 text-xs font-semibold text-[#f8f1e6] transition hover:-translate-y-0.5 hover:bg-[#30362f]"
          onClick={replyToSelectedThread}
          type="button"
        >
          <Reply className="size-3.5" />
          Reply
        </button>
      </header>

      <div className="mail-scrollbar min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-[780px] px-5 pt-8 pb-24 sm:px-9 sm:pt-11 xl:px-14">
          <div className="mb-8 flex items-center gap-2 font-mono text-[9px] tracking-[0.15em] text-[#8c7e70] uppercase">
            <span className="size-1.5 rounded-full bg-[#c76749]" />
            {thread.priorityNote ?? `${thread.category} mail`}
          </div>
          <h1 className="max-w-3xl font-serif text-[34px] leading-[1.08] font-semibold tracking-[-0.04em] text-balance sm:text-[42px]">
            {thread.subject}
          </h1>
          <div className="mt-8 h-px bg-linear-to-r from-[#d8cec0] via-[#d8cec0] to-transparent dark:from-[#464a43] dark:via-[#464a43]" />

          {thread.messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}

          <button
            className="mt-9 flex h-10 items-center gap-2 rounded-full border border-[#cfc4b5] px-4 text-sm font-semibold text-[#4e4a43] transition hover:border-[#20251f] hover:bg-[#20251f] hover:text-white dark:border-[#4b5049] dark:text-[#dbd3c7]"
            onClick={replyToSelectedThread}
            type="button"
          >
            <Reply className="size-4" />
            Reply to {thread.sender.name.split(" ")[0]}
          </button>
        </article>
      </div>
    </>
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
        "flex size-9 items-center justify-center rounded-full text-[#776e64] transition hover:bg-black/[0.045] hover:text-[#20251f] dark:text-[#a99f94] dark:hover:bg-white/[0.06] dark:hover:text-white",
        active && "text-[#b95d41]",
        className,
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className={cn("size-4", active && "fill-current")} />
    </button>
  );
}

function Message({ message }: { message: MailMessage }) {
  return (
    <section className="pt-7">
      <header className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e4dbcc] font-mono text-[10px] font-semibold text-[#5e574e] dark:bg-[#3c413a] dark:text-[#e4dbce]">
          {getInitials(message.from.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-sm font-semibold">
              {message.from.name}
            </p>
            <time className="ml-auto shrink-0 font-mono text-[9px] text-[#928578] tabular-nums">
              {formatFullDate(message.sentAt)}
            </time>
          </div>
          <p className="mt-0.5 truncate font-mono text-[9px] text-[#93877b]">
            {message.from.address} · to {formatRecipients(message)}
          </p>
        </div>
      </header>

      <div className="mt-7 space-y-5 font-serif text-[17px] leading-[1.75] tracking-[-0.008em] text-[#343832] sm:pl-[52px] sm:text-[18px] dark:text-[#ded7cc]">
        {message.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <MessageAttachments attachments={message.attachments} />
    </section>
  );
}

function MessageAttachments({
  attachments,
}: {
  attachments: MailAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-9 sm:pl-[52px]">
      <p className="mb-3 flex items-center gap-2 font-mono text-[9px] tracking-[0.14em] text-[#8d8174] uppercase">
        <Paperclip className="size-3" />
        {attachments.length} attachment
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <Attachment attachment={attachment} key={attachment.id} />
        ))}
      </div>
    </div>
  );
}

function formatRecipients(message: MailMessage) {
  const recipients = [...message.to, ...message.cc];
  return recipients.map((recipient) => recipient.name).join(", ");
}

function Attachment({ attachment }: { attachment: MailAttachment }) {
  return (
    <button
      className="group flex items-center gap-3 rounded-xl border border-[#d8cec0] bg-white/45 p-3 text-left transition hover:-translate-y-0.5 hover:border-[#b8aa98] hover:bg-white/80 dark:border-[#454a43] dark:bg-white/[0.025]"
      type="button"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#ebe2d4] text-[#765f4c] dark:bg-[#363b35] dark:text-[#d4bca9]">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">
          {attachment.name}
        </span>
        <span className="mt-0.5 block font-mono text-[8px] tracking-[0.08em] text-[#95887a] uppercase">
          {attachment.type} · {attachment.size}
        </span>
      </span>
      <Download className="size-4 text-[#96897c] transition group-hover:text-[#20251f] dark:group-hover:text-white" />
    </button>
  );
}

function EmptyReader() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center text-[#887d71]">
      <span className="mb-5 flex size-14 items-center justify-center rounded-full border border-dashed border-[#bfb3a4]">
        <MailOpen className="size-5" strokeWidth={1.5} />
      </span>
      <p className="font-serif text-xl font-semibold text-[#343832]">
        Choose a letter
      </p>
      <p className="mt-1.5 max-w-xs text-sm leading-6">
        Your selected message will open here, without taking you away from the
        inbox.
      </p>
    </div>
  );
}
