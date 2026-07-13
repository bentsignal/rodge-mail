import { useRef, useState } from "react";
import { LoaderCircle, ShieldAlert, Sparkles } from "lucide-react";

import type {
  EmailTextBlock,
  EmailTextInline,
} from "@rodge-mail/features/mail";
import { parseEmailText } from "@rodge-mail/features/mail";

import type { ThreadMessageDetail } from "../types";
import { formatFullDate, getInitials } from "../format";
import { ReaderAttachments } from "./reader-attachments";

export type ReaderViewMode = "clean" | "original";

export function ReaderMessage({
  message,
  viewMode,
}: {
  message: ThreadMessageDetail;
  viewMode: ReaderViewMode;
}) {
  const senderName = getAddressName(message.from);
  const recipients = [...message.to, ...message.cc];

  return (
    <section className="pt-7">
      <header className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-[var(--mail-seam)] bg-[var(--mail-avatar)] font-mono text-[10px] font-semibold text-[var(--mail-avatar-foreground)] shadow-[var(--mail-shadow-raised)]">
          {getInitials(senderName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-sm font-semibold">{senderName}</p>
            <time className="mail-label ml-auto shrink-0 font-mono text-[9px] tabular-nums">
              {formatFullDate(
                new Date(message.sentAt ?? message.receivedAt).toISOString(),
              )}
            </time>
          </div>
          <p className="mail-label mt-0.5 truncate font-mono text-[9px]">
            {message.from.address} · to {formatRecipients(recipients)}
          </p>
        </div>
      </header>

      <MessageOverview message={message} />

      <div className="text-foreground mt-7 space-y-5 font-serif text-[17px] leading-[1.75] tracking-[-0.008em] sm:pl-[52px] sm:text-[18px]">
        <ReaderMessageContent
          message={message}
          senderName={senderName}
          viewMode={viewMode}
        />
      </div>

      <ReaderAttachments attachments={message.attachments} />
    </section>
  );
}

function MessageOverview({ message }: { message: ThreadMessageDetail }) {
  const classification = message.classification;
  const isPreparing = isClassificationPreparing(classification?.status);
  const summary = getOverviewSummary(classification?.summary, message.snippet);
  const label = classification?.isSpam ? "Likely spam" : "Overview";
  return (
    <aside className="mail-inset mt-6 rounded-[13px] border px-4 py-3.5 sm:ml-[52px]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--mail-brass)_18%,transparent)] text-[var(--mail-brass-bright)]">
          <OverviewIcon
            isPreparing={isPreparing}
            isSpam={classification?.isSpam === true}
          />
        </span>
        <div className="min-w-0">
          <p className="mail-label font-mono text-[8px] tracking-[0.16em] uppercase">
            {label}
          </p>
          <p className="mt-1 text-sm leading-5.5 text-[var(--mail-ink-soft)]">
            {summary}
          </p>
        </div>
      </div>
    </aside>
  );
}

function OverviewIcon({
  isPreparing,
  isSpam,
}: {
  isPreparing: boolean;
  isSpam: boolean;
}) {
  if (isSpam) return <ShieldAlert className="size-3.5" />;
  if (isPreparing) return <LoaderCircle className="size-3.5 animate-spin" />;
  return <Sparkles className="size-3.5" />;
}

function ReaderMessageContent({
  message,
  senderName,
  viewMode,
}: {
  message: ThreadMessageDetail;
  senderName: string;
  viewMode: ReaderViewMode;
}) {
  const html = message.content?.sanitizedHtml;
  if (viewMode === "original" && html) {
    return (
      <OriginalHtml html={html} title={`Original email from ${senderName}`} />
    );
  }
  const body = parseEmailText(getReaderBody(message, viewMode));
  return (
    <>
      <OriginalUnavailableNotice viewMode={viewMode} />
      <EmailMessageBody blocks={body} messageId={message._id} />
    </>
  );
}

function OriginalUnavailableNotice({ viewMode }: { viewMode: ReaderViewMode }) {
  if (viewMode !== "original") return null;
  return (
    <p className="mail-label font-sans text-xs">
      Original HTML is not available for this older message. Showing its
      extracted text.
    </p>
  );
}

function OriginalHtml({ html, title }: { html: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);
  return (
    <iframe
      className="w-full rounded-xl border border-[var(--mail-seam)] bg-white shadow-[var(--mail-shadow-inset)]"
      height={height}
      onLoad={() => {
        const nextHeight = frameRef.current?.contentDocument?.body.scrollHeight;
        if (nextHeight)
          setHeight(Math.max(320, Math.min(2_400, nextHeight + 32)));
      }}
      ref={frameRef}
      referrerPolicy="no-referrer"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={html}
      title={title}
    />
  );
}

function EmailMessageBody({
  blocks,
  messageId,
}: {
  blocks: EmailTextBlock[];
  messageId: string;
}) {
  if (blocks.length === 0) {
    return <p>This message body has not been downloaded yet.</p>;
  }
  return blocks.map((block, index) => (
    <EmailBlock block={block} key={`${messageId}-${block.type}-${index}`} />
  ));
}

function EmailBlock({ block }: { block: EmailTextBlock }) {
  if (block.type === "paragraph") {
    return (
      <p className="whitespace-pre-line">
        <EmailInlineContent content={block.content} />
      </p>
    );
  }
  if (block.type === "quote") {
    return (
      <blockquote className="space-y-3 border-l-2 border-[var(--mail-brass)] pl-4 text-[var(--mail-ink-soft)]">
        {block.paragraphs.map((paragraph, index) => (
          <p className="whitespace-pre-line" key={index}>
            <EmailInlineContent content={paragraph} />
          </p>
        ))}
      </blockquote>
    );
  }
  if (block.ordered) {
    return (
      <ol className="list-decimal space-y-2 pl-6" start={block.start}>
        <EmailListItems items={block.items} />
      </ol>
    );
  }
  return (
    <ul className="list-disc space-y-2 pl-6 marker:text-[var(--mail-highlight)]">
      <EmailListItems items={block.items} />
    </ul>
  );
}

function EmailListItems({ items }: { items: EmailTextInline[][] }) {
  return items.map((item, index) => (
    <li className="pl-1 whitespace-pre-line" key={index}>
      <EmailInlineContent content={item} />
    </li>
  ));
}

function EmailInlineContent({ content }: { content: EmailTextInline[] }) {
  return content.map((token, index) => (
    <EmailInline key={`${token.type}-${index}`} token={token} />
  ));
}

function EmailInline({ token }: { token: EmailTextInline }) {
  if (token.type === "text") return <span>{token.value}</span>;
  if (token.href.toLowerCase().startsWith("mailto:")) {
    return (
      <a
        className="font-sans text-[0.84em] font-semibold text-[var(--mail-highlight)] underline decoration-current/35 underline-offset-3 hover:decoration-current"
        href={token.href}
        title={token.href}
      >
        {token.display}
      </a>
    );
  }
  return (
    <a
      className="font-sans text-[0.84em] font-semibold text-[var(--mail-highlight)] underline decoration-current/35 underline-offset-3 hover:decoration-current"
      href={token.href}
      rel="noreferrer noopener"
      target="_blank"
      title={token.href}
    >
      {token.display}
    </a>
  );
}

function formatRecipients(recipients: ThreadMessageDetail["to"]) {
  if (recipients.length === 0) return "undisclosed recipients";
  return recipients.map(getAddressName).join(", ");
}

function getAddressName(address: ThreadMessageDetail["from"]) {
  const name = address.name?.trim();
  if (name) return name;
  return address.address;
}

function readableBody(value: string | undefined, fallback: string) {
  const body = value?.trim();
  if (!body || body === "undefined" || body === "null") return fallback;
  return body;
}

function getReaderBody(message: ThreadMessageDetail, viewMode: ReaderViewMode) {
  const source =
    viewMode === "clean"
      ? (message.classification?.cleanedMarkdown ?? message.content?.plainText)
      : message.content?.plainText;
  return readableBody(source, message.snippet);
}

function getOverviewSummary(value: string | undefined, fallback: string) {
  const summary = value?.trim();
  if (summary) return summary;
  if (fallback.trim()) return fallback;
  return "Preparing a clean overview…";
}

function isClassificationPreparing(status: string | undefined) {
  return status === "pending" || status === "running";
}
