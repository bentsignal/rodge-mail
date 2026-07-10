/* eslint-disable @typescript-eslint/consistent-type-assertions -- Convex upload responses contain runtime-validated branded storage IDs. */
import { useMutation } from "convex/react";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";
import {
  getProviderAttachmentError,
  MAX_ATTACHMENT_COUNT,
  MAX_TOTAL_ATTACHMENT_BYTES,
  validateAttachmentMetadata,
} from "@rodge-mail/convex/attachments/constants";
import { toast } from "@rodge-mail/ui-web/toast";

import type { WebComposerAttachment } from "../store";
import type { MailAccountView } from "../types";
import { useMailStore } from "../store";

export function useComposeAttachments(
  provider: MailAccountView["provider"] | undefined,
) {
  const attachments = useMailStore((store) => store.composerDraft.attachments);
  const addAttachments = useMailStore((store) => store.addComposerAttachments);
  const updateAttachment = useMailStore(
    (store) => store.updateComposerAttachment,
  );
  const generateUploadUrl = useMutation(
    api.attachments.mutations.generateUploadUrl,
  );
  const finalizeUpload = useMutation(api.attachments.mutations.finalizeUpload);

  async function uploadAttachment(attachment: WebComposerAttachment) {
    try {
      const upload = await generateUploadUrl({
        contentType: attachment.contentType,
        fileName: attachment.fileName,
        size: attachment.size,
      });
      updateAttachment(attachment.id, {
        contentType: upload.contentType,
        draftAttachmentId: upload.attachmentId,
        fileName: upload.fileName,
      });
      const response = await fetch(upload.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": upload.contentType },
        body: attachment.file,
      });
      if (!response.ok) throw new Error("Attachment upload failed.");
      const finalized = await finalizeUpload({
        attachmentId: upload.attachmentId,
        storageId: parseStorageId(await response.json()),
      });
      if (!finalized.ok) throw new Error(finalized.error);
      updateAttachment(attachment.id, {
        contentType: finalized.attachment.contentType,
        draftAttachmentId: finalized.attachment._id,
        fileName: finalized.attachment.fileName,
        size: finalized.attachment.size,
        status: "ready",
      });
    } catch (error) {
      const message = getAttachmentError(error);
      updateAttachment(attachment.id, { error: message, status: "error" });
      toast.error(`${attachment.fileName}: ${message}`);
    }
  }

  async function attachFiles(files: File[]) {
    const error = getSelectionError(attachments, files, provider);
    if (error) {
      toast.error(error);
      return;
    }
    const selected = files.map(createWebAttachment);
    addAttachments(selected);
    await Promise.all(selected.map(uploadAttachment));
  }

  return {
    attachFiles,
    attachmentsAreReady: attachments.every(
      (attachment) => attachment.status === "ready",
    ),
  };
}

function getSelectionError(
  attachments: WebComposerAttachment[],
  files: File[],
  provider: MailAccountView["provider"] | undefined,
) {
  if (attachments.length + files.length > MAX_ATTACHMENT_COUNT) {
    return `Attach up to ${MAX_ATTACHMENT_COUNT} files per message.`;
  }
  const totalBytes = [...attachments, ...files].reduce(
    (total, item) => total + item.size,
    0,
  );
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    return "Attachments must total 18 MB or less.";
  }
  for (const file of files) {
    const error = validateAttachmentMetadata({
      contentType: file.type,
      fileName: file.name,
      size: file.size,
    });
    if (error) return error;
  }
  return getProviderAttachmentError(provider, [...attachments, ...files]);
}

function createWebAttachment(file: File) {
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    status: "uploading",
  } satisfies WebComposerAttachment;
}

function parseStorageId(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    !("storageId" in value) ||
    typeof value.storageId !== "string"
  ) {
    throw new Error("Upload service returned an invalid response.");
  }
  return value.storageId as Id<"_storage">;
}

function getAttachmentError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not upload attachment.";
}
