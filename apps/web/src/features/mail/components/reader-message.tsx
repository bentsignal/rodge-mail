import { useState } from "react";
import { useAction } from "convex/react";
import { Download, FileText, Paperclip } from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import { toast } from "@rodge-mail/ui-web/toast";

import type { ThreadMessageDetail } from "../types";
import { formatFullDate, getInitials } from "../format";

export function ReaderMessage({ message }: { message: ThreadMessageDetail }) {
  const senderName = getAddressName(message.from);
  const recipients = [...message.to, ...message.cc];
  const paragraphs = getMessageParagraphs(message.content?.plainText);

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
        {paragraphs.map((paragraph, index) => (
          <p key={`${message._id}-${index}`}>{paragraph}</p>
        ))}
      </div>

      <MessageAttachments attachments={message.attachments} />
    </section>
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

function getMessageParagraphs(plainText: string | undefined) {
  if (!plainText?.trim()) {
    return ["This message body has not been downloaded yet."];
  }
  return plainText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
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
