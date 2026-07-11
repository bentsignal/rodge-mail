import type { LucideIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCheck,
  EyeOff,
  MailOpen,
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
        "mail-reader-pane relative min-w-0 flex-1 flex-col bg-[var(--mail-reader)] lg:-ml-[3px] lg:border-l lg:border-[var(--mail-seam)]",
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
  const navigate = useNavigate();
  const {
    removeFromRodge,
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
        closeMobileReader={() => {
          closeMobileReader();
          void navigate({ to: "/", search: (previous) => previous });
        }}
        removeFromRodge={removeFromRodge}
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
  removeFromRodge,
  replyToSelectedThread,
  selectedMessage,
  togglePinned,
  toggleRead,
}: {
  closeMobileReader: () => void;
  removeFromRodge: (message: ThreadMessageDetail) => Promise<void>;
  replyToSelectedThread: () => void;
  selectedMessage: ThreadMessageDetail | undefined;
  togglePinned: (message: ThreadMessageDetail) => Promise<void>;
  toggleRead: (message: ThreadMessageDetail) => Promise<void>;
}) {
  return (
    <header className="mail-reader-toolbar mail-paper-soft relative z-[3] flex h-16 shrink-0 items-center gap-1 border-b border-[var(--mail-seam)] px-4 sm:px-6">
      <ReaderIconButton
        className="lg:hidden"
        icon={ArrowLeft}
        label="Back to inbox"
        onClick={closeMobileReader}
      />
      <div className="mx-1 h-5 w-px bg-[var(--mail-seam)] lg:hidden" />
      <PinReaderAction message={selectedMessage} togglePinned={togglePinned} />
      <ReadReaderAction message={selectedMessage} toggleRead={toggleRead} />
      <RemoveReaderAction
        message={selectedMessage}
        removeFromRodge={removeFromRodge}
      />
      <button
        className="mail-brass-button ml-auto flex h-11 items-center gap-2 rounded-lg px-4 text-xs font-bold transition-colors"
        onClick={replyToSelectedThread}
        type="button"
      >
        <Reply className="size-3.5" />
        Reply
      </button>
    </header>
  );
}

function RemoveReaderAction({
  message,
  removeFromRodge,
}: {
  message: ThreadMessageDetail | undefined;
  removeFromRodge: (message: ThreadMessageDetail) => Promise<void>;
}) {
  return (
    <ReaderIconButton
      icon={EyeOff}
      label="Remove from Rodge (provider copy stays unchanged)"
      onClick={message ? () => void removeFromRodge(message) : undefined}
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
      <article className="relative z-[1] mx-auto w-full max-w-[840px] px-6 pt-8 pb-28 sm:px-10 sm:pt-10 xl:px-12 xl:pt-12">
        <h1 className="max-w-3xl font-serif text-[34px] leading-[1.1] font-semibold tracking-[-0.035em] text-balance sm:text-[40px]">
          {selectedThread.subject}
        </h1>
        <div className="mt-8 h-px bg-[var(--mail-seam)] sm:mt-10" />

        {selectedThread.messages.map((message) => (
          <ReaderMessage key={message._id} message={message} />
        ))}

        <button
          className="mail-raised text-foreground mt-10 flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition hover:border-[var(--mail-brass)]"
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

function ReaderSkeleton() {
  return (
    <div aria-label="Loading thread" className="animate-pulse">
      <div className="border-border/70 h-[68px] border-b" />
      <div className="mx-auto max-w-[780px] space-y-5 px-9 pt-12">
        <div className="h-2.5 w-32 rounded-full bg-[var(--mail-paper-deep)]" />
        <div className="h-10 w-4/5 rounded-xl bg-[var(--mail-paper-soft)] shadow-[var(--mail-shadow-inset)]" />
        <div className="mt-9 h-px bg-[var(--mail-seam)]" />
        <div className="mt-8 flex gap-3">
          <div className="size-10 rounded-[11px] bg-[var(--mail-avatar)] shadow-[var(--mail-shadow-raised)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-36 rounded-full bg-[var(--mail-paper-deep)]" />
            <div className="h-2.5 w-64 rounded-full bg-[var(--mail-paper-soft)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyReader() {
  return (
    <div className="mail-label flex flex-1 flex-col items-center justify-center px-8 text-center">
      <span className="mail-inset mb-5 flex size-14 items-center justify-center rounded-[13px] border">
        <MailOpen className="size-5" strokeWidth={1.5} />
      </span>
      <p className="text-foreground font-serif text-xl font-semibold">
        Select a message
      </p>
      <p className="mt-1.5 max-w-xs text-sm leading-6">
        The message will open here.
      </p>
    </div>
  );
}

function getSenderFirstName(message: ThreadMessageDetail | undefined) {
  if (!message) return "sender";
  const sender = getAddressName(message.from);
  return sender.split(/[\s@]/)[0];
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
