/* eslint-disable @typescript-eslint/consistent-type-assertions -- Upload responses contain runtime-validated branded Convex storage IDs. */
import type { Dispatch, SetStateAction } from "react";
import { Alert } from "react-native";
import { randomUUID } from "expo-crypto";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { fetch as expoFetch } from "expo/fetch";
import { useMutation } from "convex/react";

import type { Id } from "@rodge-mail/convex/model";
import type {
  ComposerAttachment,
  ComposerDraft,
} from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import {
  MAX_ATTACHMENT_COUNT,
  MAX_TOTAL_ATTACHMENT_BYTES,
  validateAttachmentMetadata,
} from "@rodge-mail/convex/attachments/constants";

export interface NativeComposerAttachment extends ComposerAttachment {
  uri: string;
}

type NativeDraft = ComposerDraft<NativeComposerAttachment>;

export function useNativeAttachments({
  draft,
  setDraft,
}: {
  draft: NativeDraft;
  setDraft: Dispatch<SetStateAction<NativeDraft>>;
}) {
  const generateUploadUrl = useMutation(
    api.attachments.mutations.generateUploadUrl,
  );
  const finalizeUpload = useMutation(api.attachments.mutations.finalizeUpload);
  const removeDraft = useMutation(api.attachments.mutations.removeDraft);

  function updateAttachment(
    attachmentId: string,
    update: Partial<NativeComposerAttachment>,
  ) {
    setDraft((current) => ({
      ...current,
      attachments: current.attachments.map((attachment) =>
        attachment.id === attachmentId
          ? { ...attachment, ...update }
          : attachment,
      ),
    }));
  }

  async function upload(attachment: NativeComposerAttachment) {
    try {
      const pending = await generateUploadUrl({
        contentType: attachment.contentType,
        fileName: attachment.fileName,
        size: attachment.size,
      });
      updateAttachment(attachment.id, {
        contentType: pending.contentType,
        draftAttachmentId: pending.attachmentId,
        fileName: pending.fileName,
      });
      const response = await expoFetch(pending.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": pending.contentType },
        body: new File(attachment.uri),
      });
      if (!response.ok) throw new Error("Attachment upload failed.");
      const finalized = await finalizeUpload({
        attachmentId: pending.attachmentId,
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
      Alert.alert(`Couldn’t attach ${attachment.fileName}`, message);
    }
  }

  async function attachImages() {
    const selected = await selectImages(draft.attachments);
    if (!selected) return;
    setDraft((current) => ({
      ...current,
      attachments: [...current.attachments, ...selected],
    }));
    await Promise.all(selected.map(upload));
  }

  async function remove(attachment: NativeComposerAttachment) {
    try {
      if (attachment.draftAttachmentId) {
        await removeDraft({
          attachmentId: attachment.draftAttachmentId as Id<"draftAttachments">,
        });
      }
      setDraft((current) => ({
        ...current,
        attachments: current.attachments.filter(
          (item) => item.id !== attachment.id,
        ),
      }));
    } catch (error) {
      Alert.alert("Couldn’t remove attachment", getAttachmentError(error));
    }
  }

  return { attachImages, removeAttachment: remove };
}

export function getDraftAttachmentIds(attachments: NativeComposerAttachment[]) {
  return attachments.map((attachment) => {
    if (!attachment.draftAttachmentId) {
      throw new Error(`${attachment.fileName} has not finished uploading.`);
    }
    return attachment.draftAttachmentId as Id<"draftAttachments">;
  });
}

async function selectImages(current: NativeComposerAttachment[]) {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ["images"],
    selectionLimit: MAX_ATTACHMENT_COUNT,
  });
  if (result.canceled) return undefined;
  if (current.length + result.assets.length > MAX_ATTACHMENT_COUNT) {
    Alert.alert("Too many attachments", "Attach up to 5 files per message.");
    return undefined;
  }
  const selected = result.assets.map((asset, index) => {
    const file = new File(asset.uri);
    return {
      id: randomUUID(),
      uri: asset.uri,
      fileName: asset.fileName ?? `photo-${index + 1}.jpg`,
      contentType: asset.mimeType ?? file.type,
      size: asset.fileSize ?? file.size,
      status: "uploading" as const,
    };
  });
  const error = getSelectionError([...current, ...selected]);
  if (error) {
    Alert.alert("Attachment unavailable", error);
    return undefined;
  }
  return selected;
}

function getSelectionError(attachments: NativeComposerAttachment[]) {
  const totalBytes = attachments.reduce(
    (total, attachment) => total + attachment.size,
    0,
  );
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    return "Files must total 18 MB or less.";
  }
  for (const attachment of attachments) {
    const error = validateAttachmentMetadata(attachment);
    if (error) return error;
  }
  return undefined;
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
  return "Rodge Mail could not upload this attachment.";
}
