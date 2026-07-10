import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { AuthedMutationCtx } from "../utils";
import {
  getProviderAttachmentError,
  MAX_ATTACHMENT_COUNT,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from "../attachments/constants";

export function validateSendRequest(
  account: Doc<"mailAccounts">,
  args: {
    idempotencyKey: string;
    plainText: string;
    to: { address: string; name?: string }[];
  },
) {
  if (
    !["gmail", "microsoft", "icloud"].includes(account.provider) ||
    !["connected", "syncing"].includes(account.status)
  ) {
    throw new ConvexError("The selected account cannot send mail");
  }
  const idempotencyKey = args.idempotencyKey.trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw new ConvexError("A stable idempotency key is required");
  }
  if (args.to.length === 0 || !args.plainText.trim()) {
    throw new ConvexError("A recipient and message body are required");
  }
  return idempotencyKey;
}

export function validateProviderAttachments(
  account: Doc<"mailAccounts">,
  attachments: Doc<"draftAttachments">[],
) {
  const error = getProviderAttachmentError(
    account.provider,
    attachments.map((attachment) => ({ size: attachment.size ?? 0 })),
  );
  if (error) throw new ConvexError(error);
}

export async function getReadyDraftAttachments(
  ctx: AuthedMutationCtx,
  requestedIds: Id<"draftAttachments">[],
) {
  const attachmentIds = [...new Set(requestedIds)];
  if (attachmentIds.length !== requestedIds.length) {
    throw new ConvexError("Duplicate attachments are not allowed");
  }
  if (attachmentIds.length > MAX_ATTACHMENT_COUNT) {
    throw new ConvexError("A message can include up to 5 attachments");
  }
  const documents = await Promise.all(
    attachmentIds.map(async (attachmentId) => await ctx.db.get(attachmentId)),
  );
  const attachments = documents.flatMap((attachment) =>
    getReadyOwnedAttachment(attachment, ctx.ownerId),
  );
  if (attachments.length !== attachmentIds.length) {
    throw new ConvexError("Every attachment must finish uploading first");
  }
  const totalBytes = attachments.reduce(
    (total, attachment) => total + (attachment.size ?? 0),
    0,
  );
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new ConvexError("Attachments must total 18 MB or less");
  }
  return { attachmentIds, attachments };
}

export function attachmentIdsMatch(
  existingIds: Id<"draftAttachments">[],
  requestedIds: Id<"draftAttachments">[],
) {
  return (
    existingIds.length === requestedIds.length &&
    existingIds.every((attachmentId) => requestedIds.includes(attachmentId))
  );
}

function getReadyOwnedAttachment(
  attachment: Doc<"draftAttachments"> | null,
  ownerId: string,
) {
  if (attachment?.ownerId !== ownerId) return [];
  if (attachment.status !== "ready") return [];
  if (!attachment.storageId || attachment.size === undefined) return [];
  return [attachment];
}
