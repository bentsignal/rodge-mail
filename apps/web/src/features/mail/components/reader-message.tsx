import { useState } from "react";
import { useAction } from "convex/react";
import { Download, FileText, Paperclip } from "lucide-react";

import type {
  EmailTextBlock,
  EmailTextInline,
} from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import { parseEmailText } from "@rodge-mail/features/mail";
import { toast } from "@rodge-mail/ui-web/toast";

import type { ThreadMessageDetail } from "../types";
import { formatFullDate, getInitials } from "../format";

export function ReaderMessage({ message }: { message: ThreadMessageDetail }) {
  const senderName = getAddressName(message.from);
  const recipients = [...message.to, ...message.cc];
  const body = parseEmailText(message.content?.plainText);

  return (
    <section className="pt-7">
      <header className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e4dbcc] font-mono text-[10px] font-semibold text-[#5e574e] dark:bg-[#3c413a] dark:text-[#e4dbce]">
          {getInitials(senderName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-sm font-semibold">{senderName}</p>
            <time className="ml-auto shrink-0 font-mono text-[9px] text-[#928578] tabular-nums">
              {formatFullDate(
                new Date(message.sentAt ?? message.receivedAt).toISOString(),
              )}
            </time>
          </div>
          <p className="mt-0.5 truncate font-mono text-[9px] text-[#93877b]">
            {message.from.address} · to {formatRecipients(recipients)}
          </p>
        </div>
      </header>

      <div className="mt-7 space-y-5 font-serif text-[17px] leading-[1.75] tracking-[-0.008em] text-[#343832] sm:pl-[52px] sm:text-[18px] dark:text-[#ded7cc]">
        <EmailMessageBody blocks={body} messageId={message._id} />
      </div>

      <MessageAttachments attachments={message.attachments} />
    </section>
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
      <blockquote className="space-y-3 border-l-2 border-[#cfc4b5] pl-4 text-[#746a5f] dark:border-[#4b5049] dark:text-[#aaa095]">
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
    <ul className="list-disc space-y-2 pl-6 marker:text-[#b95d41]">
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
        className="font-sans text-[0.84em] font-semibold text-[#a75139] underline decoration-[#c76749]/35 underline-offset-3 hover:decoration-[#c76749] dark:text-[#df896b]"
        href={token.href}
        title={token.href}
      >
        {token.display}
      </a>
    );
  }
  return (
    <a
      className="font-sans text-[0.84em] font-semibold text-[#a75139] underline decoration-[#c76749]/35 underline-offset-3 hover:decoration-[#c76749] dark:text-[#df896b]"
      href={token.href}
      rel="noreferrer noopener"
      target="_blank"
      title={token.href}
    >
      {token.display}
    </a>
  );
}

function MessageAttachments({
  attachments,
}: {
  attachments: ThreadMessageDetail["attachments"];
}) {
  const downloadAttachment = useAction(api.attachments.actions.download);
  const [downloadingId, setDownloadingId] = useState<string>();

  async function download(
    attachment: ThreadMessageDetail["attachments"][number],
  ) {
    if (downloadingId) return;
    setDownloadingId(attachment._id);
    try {
      const { url } = await downloadAttachment({
        attachmentId: attachment._id,
      });
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.fileName;
      link.rel = "noopener";
      link.click();
    } catch (error) {
      toast.error(getDownloadError(error));
    }
    setDownloadingId(undefined);
  }

  if (attachments.length === 0) return null;

  return (
    <div className="mt-9 sm:pl-[52px]">
      <p className="mb-3 flex items-center gap-2 font-mono text-[9px] tracking-[0.14em] text-[#8d8174] uppercase">
        <Paperclip className="size-3" />
        {attachments.length} attachment
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <button
            className="group flex items-center gap-3 rounded-xl border border-[#d8cec0] bg-white/45 p-3 text-left transition hover:-translate-y-0.5 hover:border-[#b8aa98] hover:bg-white/80 dark:border-[#454a43] dark:bg-white/[0.025]"
            key={attachment._id}
            disabled={downloadingId !== undefined}
            onClick={() => void download(attachment)}
            title="Download attachment"
            type="button"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#ebe2d4] text-[#765f4c] dark:bg-[#363b35] dark:text-[#d4bca9]">
              <FileText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                {attachment.fileName}
              </span>
              <span className="mt-0.5 block font-mono text-[8px] tracking-[0.08em] text-[#95887a] uppercase">
                {attachment.contentType} · {formatFileSize(attachment.size)}
              </span>
            </span>
            <Download
              className={`size-4 text-[#96897c] transition group-hover:text-[#20251f] dark:group-hover:text-white ${downloadingId === attachment._id ? "animate-bounce" : ""}`}
            />
          </button>
        ))}
      </div>
    </div>
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

function getDownloadError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not download this attachment.";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
