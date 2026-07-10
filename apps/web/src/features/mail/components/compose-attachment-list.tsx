/* eslint-disable @typescript-eslint/consistent-type-assertions -- Draft IDs are runtime-validated Convex mutation results. */
import { useMutation } from "convex/react";
import { AlertCircle, LoaderCircle, Paperclip, X } from "lucide-react";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";
import { toast } from "@rodge-mail/ui-web/toast";

import type { WebComposerAttachment } from "../store";
import { useMailStore } from "../store";

export function DraftAttachments() {
  const attachments = useMailStore((store) => store.composerDraft.attachments);
  const removeAttachment = useMailStore(
    (store) => store.removeComposerAttachment,
  );
  const removeDraft = useMutation(api.attachments.mutations.removeDraft);
  if (attachments.length === 0) return null;

  function remove(attachment: WebComposerAttachment) {
    if (attachment.draftAttachmentId) {
      void removeDraft({
        attachmentId: attachment.draftAttachmentId as Id<"draftAttachments">,
      }).catch((error) => toast.error(getRemoveError(error)));
    }
    removeAttachment(attachment.id);
  }

  return (
    <div className="flex flex-wrap gap-2 pb-5">
      {attachments.map((attachment) => (
        <span
          className="flex items-center gap-2 rounded-full border border-[#d4c9bb] bg-white/60 py-1.5 pr-1.5 pl-3 text-xs dark:border-[#484d46] dark:bg-white/[0.035]"
          key={attachment.id}
        >
          <AttachmentStatusIcon status={attachment.status} />
          <span className="max-w-56 truncate">
            {attachment.fileName}
            <span className="ml-1 text-[#8f8173]">
              · {getAttachmentStatus(attachment)}
            </span>
          </span>
          <button
            aria-label={`Remove ${attachment.fileName}`}
            className="flex size-5 items-center justify-center rounded-full hover:bg-black/[0.06]"
            disabled={attachment.status === "uploading"}
            onClick={() => remove(attachment)}
            type="button"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function AttachmentStatusIcon({
  status,
}: {
  status: WebComposerAttachment["status"];
}) {
  if (status === "uploading") {
    return <LoaderCircle className="size-3 animate-spin text-[#8f8173]" />;
  }
  if (status === "error") {
    return <AlertCircle className="size-3 text-red-600" />;
  }
  return <Paperclip className="size-3 text-[#8f8173]" />;
}

function getAttachmentStatus(attachment: WebComposerAttachment) {
  if (attachment.status === "uploading") return "uploading";
  if (attachment.status === "error") return attachment.error ?? "failed";
  return formatAttachmentSize(attachment.size);
}

export function getUploadSummary(attachments: WebComposerAttachment[]) {
  const uploading = attachments.filter(
    (attachment) => attachment.status === "uploading",
  ).length;
  if (uploading > 0) return `Uploading ${uploading}…`;
  const total = attachments.reduce(
    (bytes, attachment) => bytes + attachment.size,
    0,
  );
  if (attachments.length === 0) return "Up to 5 files · 18 MB";
  return `${attachments.length}/5 · ${formatAttachmentSize(total)}`;
}

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getRemoveError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not remove attachment.";
}
