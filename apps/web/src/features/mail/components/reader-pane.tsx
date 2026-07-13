import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Code2, MailOpen, Reply, Sparkles } from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import { cn } from "@rodge-mail/std/cn";

import type { MailThreadDetail, ThreadMessageDetail } from "../types";
import type { ReaderViewMode } from "./reader-message";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { ReaderMessage } from "./reader-message";
import { ReaderToolbar } from "./reader-toolbar";

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
    archiveThread,
    mailMode,
    permanentlyDeleteArchivedThread,
    replyToSelectedThread,
    restoreArchivedThread,
    selectedMessageId,
    selectedThread,
    togglePinned,
    toggleRead,
  } = useLiveMail();
  const requestCleanView = useMutation(
    api.classification.mutations.requestCleanView,
  );
  const setSpamState = useMutation(api.classification.mutations.setSpamState);

  // eslint-disable-next-line no-restricted-syntax -- Opening a thread synchronizes its stored clean-reader classification with the current prompt.
  useEffect(() => {
    if (!selectedThread) return;
    for (const message of selectedThread.messages) {
      if (message.classification?.cleanedMarkdown !== undefined) continue;
      void requestCleanView({ messageId: message._id }).catch(() => undefined);
    }
  }, [requestCleanView, selectedThread]);

  if (!selectedThread) return null;
  const selectedMessage = getSelectedMessage(selectedThread, selectedMessageId);

  return (
    <>
      <ReaderToolbar
        closeMobileReader={() => {
          closeMobileReader();
          void navigate({
            to:
              mailMode === "archive"
                ? "/archive"
                : mailMode === "spam"
                  ? "/spam"
                  : "/",
            search: (previous) => previous,
          });
        }}
        archiveThread={archiveThread}
        mailMode={mailMode}
        markNotSpam={async (message) => {
          await setSpamState({ messageId: message._id, isSpam: false });
          closeMobileReader();
          await navigate({ to: "/spam", search: (previous) => previous });
        }}
        permanentlyDeleteArchivedThread={permanentlyDeleteArchivedThread}
        replyToSelectedThread={replyToSelectedThread}
        restoreArchivedThread={restoreArchivedThread}
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

function ReaderArticle({
  replyToSelectedThread,
  selectedMessage,
  selectedThread,
}: {
  replyToSelectedThread: () => void;
  selectedMessage: ThreadMessageDetail | undefined;
  selectedThread: MailThreadDetail;
}) {
  const [viewMode, setViewMode] = useState<ReaderViewMode>("clean");
  return (
    <div className="mail-scrollbar min-h-0 flex-1 overflow-y-auto">
      <article className="relative z-[1] mx-auto w-full max-w-[840px] px-6 pt-8 pb-28 sm:px-10 sm:pt-10 xl:px-12 xl:pt-12">
        <h1 className="max-w-3xl font-serif text-[34px] leading-[1.1] font-semibold tracking-[-0.035em] text-balance sm:text-[40px]">
          {selectedThread.subject}
        </h1>
        <div className="mt-8 h-px bg-[var(--mail-seam)] sm:mt-10" />

        <ReaderViewSwitch onChange={setViewMode} value={viewMode} />

        {selectedThread.messages.map((message) => (
          <ReaderMessage
            key={message._id}
            message={message}
            viewMode={viewMode}
          />
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

function ReaderViewSwitch({
  onChange,
  value,
}: {
  onChange: (value: ReaderViewMode) => void;
  value: ReaderViewMode;
}) {
  return (
    <div
      aria-label="Message view"
      className="mail-inset mt-5 inline-flex rounded-[10px] border p-1"
      role="group"
    >
      <ReaderViewButton
        icon={Sparkles}
        label="Clean"
        onClick={() => onChange("clean")}
        selected={value === "clean"}
      />
      <ReaderViewButton
        icon={Code2}
        label="Original"
        onClick={() => onChange("original")}
        selected={value === "original"}
      />
    </div>
  );
}

function ReaderViewButton({
  icon: Icon,
  label,
  onClick,
  selected,
}: {
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-[7px] px-3 font-mono text-[9px] font-semibold tracking-[0.08em] uppercase transition",
        selected
          ? "text-foreground bg-[var(--mail-paper)] shadow-[var(--mail-shadow-raised)]"
          : "hover:text-foreground text-[var(--mail-ink-soft)]",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-3" />
      {label}
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
