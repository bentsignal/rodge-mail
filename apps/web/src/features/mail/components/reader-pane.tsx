import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowLeft,
  CheckCheck,
  MailOpen,
  MoreHorizontal,
  Pin,
  Reply,
} from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { MailThreadDetail, ThreadMessageDetail } from "../types";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { ReaderMessage } from "./reader-message";

export function ReaderPane() {
  const mobileReaderIsOpen = useMailStore((store) => store.mobileReaderIsOpen);
  const { isLoadingThread, selectedThread } = useLiveMail();

  return (
    <section
      aria-label="Message reader"
      className={cn(
        "min-w-0 flex-1 flex-col bg-[#fbf8f1] dark:bg-[#242823]",
        mobileReaderIsOpen ? "flex" : "hidden lg:flex",
      )}
    >
      <ReaderState
        hasSelectedThread={selectedThread !== undefined}
        isLoading={isLoadingThread}
      />
    </section>
  );
}

function ReaderState({
  hasSelectedThread,
  isLoading,
}: {
  hasSelectedThread: boolean;
  isLoading: boolean;
}) {
  if (isLoading) return <ReaderSkeleton />;
  if (!hasSelectedThread) return <EmptyReader />;
  return <ReaderContent />;
}

function ReaderContent() {
  const closeMobileReader = useMailStore((store) => store.closeMobileReader);
  const {
    replyToSelectedThread,
    selectedMessageId,
    selectedThread,
    togglePinned,
    toggleRead,
  } = useLiveMail();

  if (!selectedThread) return null;
  const selectedMessage = getSelectedMessage(selectedThread, selectedMessageId);

  return (
    <>
      <ReaderToolbar
        closeMobileReader={closeMobileReader}
        replyToSelectedThread={replyToSelectedThread}
        selectedMessage={selectedMessage}
        togglePinned={togglePinned}
        toggleRead={toggleRead}
      />
      <ReaderArticle
        replyToSelectedThread={replyToSelectedThread}
        selectedMessage={selectedMessage}
        selectedThread={selectedThread}
      />
    </>
  );
}

function ReaderToolbar({
  closeMobileReader,
  replyToSelectedThread,
  selectedMessage,
  togglePinned,
  toggleRead,
}: {
  closeMobileReader: () => void;
  replyToSelectedThread: () => void;
  selectedMessage: ThreadMessageDetail | undefined;
  togglePinned: (message: ThreadMessageDetail) => Promise<void>;
  toggleRead: (message: ThreadMessageDetail) => Promise<void>;
}) {
  return (
    <header className="border-border/70 flex h-[68px] shrink-0 items-center gap-1 border-b px-3 sm:px-5">
      <ReaderIconButton
        className="lg:hidden"
        icon={ArrowLeft}
        label="Back to inbox"
        onClick={closeMobileReader}
      />
      <div className="mx-1 h-5 w-px bg-[#ded5c8] lg:hidden dark:bg-[#3f433d]" />
      <PinReaderAction message={selectedMessage} togglePinned={togglePinned} />
      <ReadReaderAction message={selectedMessage} toggleRead={toggleRead} />
      <ReaderIconButton icon={Archive} label="Archive is not available yet" />
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

function ReaderArticle({
  replyToSelectedThread,
  selectedMessage,
  selectedThread,
}: {
  replyToSelectedThread: () => void;
  selectedMessage: ThreadMessageDetail | undefined;
  selectedThread: MailThreadDetail;
}) {
  return (
    <div className="mail-scrollbar min-h-0 flex-1 overflow-y-auto">
      <article className="mx-auto w-full max-w-[780px] px-5 pt-8 pb-24 sm:px-9 sm:pt-11 xl:px-14">
        <div className="mb-8 flex items-center gap-2 font-mono text-[9px] tracking-[0.15em] text-[#8c7e70] uppercase">
          <span className="size-1.5 rounded-full bg-[#c76749]" />
          {getPriorityLabel(selectedMessage)}
        </div>
        <h1 className="max-w-3xl font-serif text-[34px] leading-[1.08] font-semibold tracking-[-0.04em] text-balance sm:text-[42px]">
          {selectedThread.subject}
        </h1>
        <div className="mt-8 h-px bg-linear-to-r from-[#d8cec0] via-[#d8cec0] to-transparent dark:from-[#464a43] dark:via-[#464a43]" />

        {selectedThread.messages.map((message) => (
          <ReaderMessage key={message._id} message={message} />
        ))}

        <button
          className="mt-9 flex h-10 items-center gap-2 rounded-full border border-[#cfc4b5] px-4 text-sm font-semibold text-[#4e4a43] transition hover:border-[#20251f] hover:bg-[#20251f] hover:text-white dark:border-[#4b5049] dark:text-[#dbd3c7]"
          onClick={replyToSelectedThread}
          type="button"
        >
          <Reply className="size-4" />
          Reply to {getSenderFirstName(selectedMessage)}
        </button>
      </article>
    </div>
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
        "flex size-9 items-center justify-center rounded-full text-[#776e64] transition hover:bg-black/[0.045] hover:text-[#20251f] disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#a99f94] dark:hover:bg-white/[0.06] dark:hover:text-white",
        active && "text-[#b95d41]",
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

function ReaderSkeleton() {
  return (
    <div aria-label="Loading thread" className="animate-pulse">
      <div className="border-border/70 h-[68px] border-b" />
      <div className="mx-auto max-w-[780px] space-y-5 px-9 pt-12">
        <div className="h-2.5 w-32 rounded-full bg-[#e1d8cb] dark:bg-[#3a3f39]" />
        <div className="h-10 w-4/5 rounded-xl bg-[#e5dccf] dark:bg-[#363b35]" />
        <div className="mt-9 h-px bg-[#ddd3c5] dark:bg-[#40443e]" />
        <div className="mt-8 flex gap-3">
          <div className="size-10 rounded-full bg-[#e4dbcc] dark:bg-[#3c413a]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-36 rounded-full bg-[#e1d8cb] dark:bg-[#3a3f39]" />
            <div className="h-2.5 w-64 rounded-full bg-[#e9e1d5] dark:bg-[#343832]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyReader() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center text-[#887d71]">
      <span className="mb-5 flex size-14 items-center justify-center rounded-full border border-dashed border-[#bfb3a4]">
        <MailOpen className="size-5" strokeWidth={1.5} />
      </span>
      <p className="font-serif text-xl font-semibold text-[#343832] dark:text-[#ded7cc]">
        Choose a letter
      </p>
      <p className="mt-1.5 max-w-xs text-sm leading-6">
        Your selected message will open here, without taking you away from the
        inbox.
      </p>
    </div>
  );
}

function getSenderFirstName(message: ThreadMessageDetail | undefined) {
  if (!message) return "sender";
  const sender = getAddressName(message.from);
  return sender.split(/[\s@]/)[0];
}

function getPriorityLabel(message: ThreadMessageDetail | undefined) {
  if (!message) return "unclassified mail";
  return message.classification?.reason ?? `${message.focusBucket} mail`;
}

function getSelectedMessage(
  thread: MailThreadDetail,
  messageId: ThreadMessageDetail["_id"] | undefined,
) {
  return (
    thread.messages.find((message) => message._id === messageId) ??
    thread.messages.at(-1)
  );
}

function getAddressName(address: ThreadMessageDetail["from"]) {
  const name = address.name?.trim();
  if (name) return name;
  return address.address;
}
