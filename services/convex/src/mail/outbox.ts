import { ConvexError } from "convex/values";

import { normalizeRecipientFields } from "@rodge-mail/features/mail";

import type { Doc, Id } from "../_generated/dataModel";
import type { AuthedMutationCtx } from "../utils";
import {
  getProviderAttachmentError,
  MAX_ATTACHMENT_COUNT,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from "../attachments/constants";

export function canRetryOutbox(outbox: Pick<Doc<"outboxMessages">, "status">) {
  return outbox.status === "failed";
}

export function getRetryOutboxUpdate(now: number) {
  return {
    error: undefined,
    status: "pending" as const,
    updatedAt: now,
  };
}

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

export function validateRecipientFields(args: {
  bcc?: readonly { address: string; name?: string }[];
  cc?: readonly { address: string; name?: string }[];
  to: readonly { address: string; name?: string }[];
}) {
  const result = normalizeRecipientFields({
    bcc: args.bcc ?? [],
    cc: args.cc ?? [],
    to: args.to,
  });
  throwForInvalidRecipients("To", result.invalid.to);
  throwForInvalidRecipients("CC", result.invalid.cc);
  throwForInvalidRecipients("BCC", result.invalid.bcc);
  if (result.recipients.to.length === 0) {
    throw new ConvexError("At least one valid To recipient is required");
  }
  return result.recipients;
}

function throwForInvalidRecipients(field: string, invalid: string[]) {
  if (invalid.length === 0) return;
  const noun = invalid.length === 1 ? "recipient" : "recipients";
  throw new ConvexError(`Invalid ${field} ${noun}: ${invalid.join(", ")}`);
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
  existingIds: readonly string[],
  requestedIds: readonly string[],
) {
  return (
    existingIds.length === requestedIds.length &&
    existingIds.every((attachmentId) => requestedIds.includes(attachmentId))
  );
}

interface EnqueuePayload {
  attachmentIds?: readonly string[];
  bcc: readonly { address: string; name?: string }[];
  cc: readonly { address: string; name?: string }[];
  plainText: string;
  replyToMessageId?: string;
  subject: string;
  to: readonly { address: string; name?: string }[];
}

export function getIdempotentEnqueueResult<TId extends string>(
  existing: EnqueuePayload & {
    _id: TId;
    status: Doc<"outboxMessages">["status"];
  },
  requested: EnqueuePayload,
) {
  if (!enqueuePayloadsMatch(existing, requested)) {
    throw new ConvexError(
      "This send attempt already exists with different message content",
    );
  }
  if (existing.status === "failed") {
    throw new ConvexError(
      "This send attempt failed. Retry it from the outbox.",
    );
  }
  return {
    outboxId: existing._id,
    reused: true,
    status: existing.status,
  } as const;
}

function enqueuePayloadsMatch(
  existing: EnqueuePayload,
  requested: EnqueuePayload,
) {
  return (
    mailboxAddressesMatch(existing.to, requested.to) &&
    mailboxAddressesMatch(existing.cc, requested.cc) &&
    mailboxAddressesMatch(existing.bcc, requested.bcc) &&
    existing.subject === requested.subject &&
    existing.plainText === requested.plainText &&
    existing.replyToMessageId === requested.replyToMessageId &&
    attachmentIdsMatch(
      existing.attachmentIds ?? [],
      requested.attachmentIds ?? [],
    )
  );
}

function mailboxAddressesMatch(
  existing: readonly { address: string; name?: string }[],
  requested: readonly { address: string; name?: string }[],
) {
  return (
    existing.length === requested.length &&
    existing.every(
      (recipient, index) =>
        recipient.address === requested[index]?.address &&
        recipient.name === requested[index]?.name,
    )
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
