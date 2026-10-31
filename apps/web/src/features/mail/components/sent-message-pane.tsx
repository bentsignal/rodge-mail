import type { FunctionReturnType } from "convex/server";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock3,
  LoaderCircle,
  Paperclip,
  RotateCcw,
  Send,
} from "lucide-react";

import type { api } from "@rodge-mail/convex/api";
import type { Id } from "@rodge-mail/convex/model";
import {
  formatRecipientAddresses,
  getSentStatusLabel,
  getSentSubject,
} from "@rodge-mail/features/mail";
import { cn } from "@rodge-mail/std/cn";

import { QuickLink } from "~/components/quick-link";
import { formatFullDate } from "../format";
import { useSelectedOutboxId, useSentMessageQuery } from "../sent-live-data";
import { useRetryOutbox } from "../use-retry-outbox";
import { ReaderSkeleton } from "./reader-empty-states";
import { ReaderPane } from "./reader-pane";

type SentMessage = NonNullable<
  FunctionReturnType<typeof api.outbox.queries.getSentMessage>
>;

/**
 * Delivered mail whose provider copy is in the mailbox opens in the reader;
 * everything else shows what Rodge queued or sent.
 */
export function SentReader() {
  const outboxId = useSelectedOutboxId();
  const query = useSentMessageQuery(outboxId);
  if (!outboxId) {
    return (
      <SentReaderFrame hiddenOnMobile>
        <SentPlaceholder title="Select a sent message" />
      </SentReaderFrame>
    );
  }
  if (query.isPending) {
    return (
      <SentReaderFrame>
        <ReaderSkeleton />
      </SentReaderFrame>
    );
  }
  if (!query.data) {
    return (
      <SentReaderFrame>
        <SentPlaceholder title="Message not found" />
      </SentReaderFrame>
    );
  }
  if (query.data.threadId) return <ReaderPane />;
  return (
    <SentReaderFrame>
      <SentMessageView message={query.data} />
    </SentReaderFrame>
  );
}

function SentReaderFrame({
  children,
  hiddenOnMobile = false,
}: {
  children: React.ReactNode;
  hiddenOnMobile?: boolean;
}) {
  return (
    <section
      aria-label="Message reader"
      className={cn(
        "bg-background lg:border-border relative min-w-0 flex-1 flex-col lg:-ml-[3px] lg:border-l",
        hiddenOnMobile ? "hidden lg:flex" : "flex",
      )}
    >
      {children}
    </section>
  );
}

function SentPlaceholder({ title }: { title: string }) {
  return (
    <div className="mail-label flex flex-1 flex-col items-center justify-center px-8 text-center">
      <span className="bg-muted mb-5 flex size-14 items-center justify-center rounded-[13px] border">
        <Send className="size-5" strokeWidth={1.5} />
      </span>
      <p className="text-foreground text-xl font-semibold">{title}</p>
    </div>
  );
}

function SentMessageView({ message }: { message: SentMessage }) {
  return (
    <>
      <div className="border-border flex h-[68px] shrink-0 items-center gap-2 border-b px-4 sm:px-6">
        <QuickLink
          aria-label="Back to Sent"
          className="hover:bg-muted flex size-10 items-center justify-center rounded-lg lg:hidden"
          to="/sent"
        >
          <ArrowLeft className="size-4" />
        </QuickLink>
        <SentStatusBadge status={message.status} />
        <div className="ml-auto">
          <FailedRetryButton message={message} />
        </div>
      </div>
      <div className="mail-scrollbar min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-[840px] px-6 pt-8 pb-28 sm:px-10 sm:pt-10 xl:px-12 xl:pt-12">
          <h1 className="max-w-3xl text-[34px] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[40px]">
            {getSentSubject(message.subject)}
          </h1>
          <SentFailure message={message} />
          <div className="bg-border mt-8 h-px sm:mt-10" />
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            <SentHeaderRow label="From" value={message.account.address} />
            <SentHeaderRow
              label="To"
              value={formatRecipientAddresses(message.to)}
            />
            <SentHeaderRow
              label="Cc"
              value={formatRecipientAddresses(message.cc)}
            />
            <SentHeaderRow
              label="Bcc"
              value={formatRecipientAddresses(message.bcc)}
            />
            <SentHeaderRow
              label={message.sentAt ? "Sent" : "Queued"}
              value={formatFullDate(
                new Date(message.sentAt ?? message.createdAt).toISOString(),
              )}
            />
          </dl>
          <div className="text-foreground mt-8 text-[17px] leading-[1.75] tracking-[-0.008em] whitespace-pre-wrap sm:text-[18px]">
            {message.plainText}
          </div>
          <SentAttachments attachments={message.attachments} />
        </article>
      </div>
    </>
  );
}

function FailedRetryButton({ message }: { message: SentMessage }) {
  if (message.status !== "failed") return null;
  return <RetryOutboxButton outboxId={message._id} />;
}

function SentHeaderRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <>
      <dt className="mail-label font-medium">{label}</dt>
      <dd className="text-foreground min-w-0 break-words">{value}</dd>
    </>
  );
}

function SentFailure({ message }: { message: SentMessage }) {
  if (message.status !== "failed" || !message.error) return null;
  return (
    <p
      className="bg-destructive/8 text-destructive mt-5 rounded-lg px-3 py-2.5 text-sm leading-5"
      role="alert"
    >
      {message.error}
    </p>
  );
}

function SentAttachments({
  attachments,
}: {
  attachments: SentMessage["attachments"];
}) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mt-10 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <li key={attachment.fileName}>
          <SentAttachment attachment={attachment} />
        </li>
      ))}
    </ul>
  );
}

function SentAttachment({
  attachment,
}: {
  attachment: SentMessage["attachments"][number];
}) {
  const className =
    "bg-muted flex h-10 max-w-[320px] items-center gap-2 rounded-lg border px-3 text-[13px]";
  if (!attachment.url) {
    return (
      <div className={className}>
        <SentAttachmentLabel attachment={attachment} />
      </div>
    );
  }
  return (
    <a
      className={cn(className, "hover:bg-accent")}
      download={attachment.fileName}
      href={attachment.url}
      rel="noreferrer"
      target="_blank"
    >
      <SentAttachmentLabel attachment={attachment} />
    </a>
  );
}

function SentAttachmentLabel({
  attachment,
}: {
  attachment: SentMessage["attachments"][number];
}) {
  return (
    <>
      <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{attachment.fileName}</span>
      <span className="mail-label shrink-0">{formatSize(attachment.size)}</span>
    </>
  );
}

export function SentStatusBadge({ status }: { status: SentMessage["status"] }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-wide uppercase",
        status === "failed"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Icon
        className={cn("size-3.5", status === "sending" && "animate-spin")}
      />
      {getSentStatusLabel(status)}
    </span>
  );
}

const STATUS_ICONS = {
  failed: AlertCircle,
  pending: Clock3,
  sending: LoaderCircle,
  sent: Check,
} satisfies Record<SentMessage["status"], typeof Check>;

export function RetryOutboxButton({
  outboxId,
}: {
  outboxId: Id<"outboxMessages">;
}) {
  const retry = useRetryOutbox();
  return (
    <button
      className="text-destructive hover:bg-destructive/8 bg-background flex h-8 items-center gap-1.5 rounded-full border border-current/20 px-3 text-[11px] font-semibold"
      onClick={() => retry(outboxId)}
      type="button"
    >
      <RotateCcw className="size-3" />
      Retry
    </button>
  );
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
