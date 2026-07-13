import { useState } from "react";
import { useAction } from "convex/react";
import { Download, FileText, Paperclip } from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import { normalizeAttachmentFileName } from "@rodge-mail/convex/attachments/constants";
import { toast } from "@rodge-mail/ui-web/toast";

import type { ThreadMessageDetail } from "../types";
import { downloadAttachmentFile } from "../download-attachment";

export function ReaderAttachments({
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
      await downloadAttachmentFile({ fileName: attachment.fileName, url });
    } catch (error) {
      toast.error(getDownloadError(error));
    }
    setDownloadingId(undefined);
  }

  if (attachments.length === 0) return null;
  return (
    <div className="mt-9 sm:pl-[52px]">
      <p className="mail-label mb-3 flex items-center gap-2 font-mono text-[9px] tracking-[0.14em] uppercase">
        <Paperclip className="size-3" />
        {attachments.length} attachment
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <AttachmentButton
            attachment={attachment}
            disabled={downloadingId !== undefined}
            isDownloading={downloadingId === attachment._id}
            key={attachment._id}
            onDownload={() => void download(attachment)}
          />
        ))}
      </div>
    </div>
  );
}

function AttachmentButton({
  attachment,
  disabled,
  isDownloading,
  onDownload,
}: {
  attachment: ThreadMessageDetail["attachments"][number];
  disabled: boolean;
  isDownloading: boolean;
  onDownload: () => void;
}) {
  const fileName =
    normalizeAttachmentFileName(attachment.fileName) || "attachment";
  return (
    <button
      aria-label={`Download ${fileName}`}
      className="mail-raised group flex items-center gap-3 rounded-[11px] border p-3 text-left transition hover:border-[var(--mail-brass)]"
      disabled={disabled}
      onClick={onDownload}
      title={`Download ${fileName}`}
      type="button"
    >
      <span className="mail-inset flex size-10 shrink-0 items-center justify-center rounded-[9px] border text-[var(--mail-brass-deep)] dark:text-[var(--mail-brass-bright)]">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{fileName}</span>
        <span className="mail-label mt-0.5 block font-mono text-[8px] tracking-[0.08em] uppercase">
          {attachment.contentType} · {formatFileSize(attachment.size)}
        </span>
      </span>
      <Download
        className={`group-hover:text-foreground size-4 text-[var(--mail-ink-soft)] transition ${isDownloading ? "animate-bounce" : ""}`}
      />
    </button>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDownloadError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not download this attachment.";
}
