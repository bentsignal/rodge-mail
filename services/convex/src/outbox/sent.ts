import type { Doc } from "../_generated/dataModel";

export const SENT_SNIPPET_LENGTH = 160;

export function toSentSnippet(plainText: string) {
  const collapsed = plainText.replace(/\s+/gu, " ").trim();
  if (collapsed.length <= SENT_SNIPPET_LENGTH) return collapsed;
  return `${collapsed.slice(0, SENT_SNIPPET_LENGTH - 1).trimEnd()}…`;
}

type DraftAttachmentSummary = Pick<
  Doc<"draftAttachments">,
  "contentType" | "declaredSize" | "fileName" | "size"
>;

export function toSentAttachment(attachment: DraftAttachmentSummary) {
  return {
    contentType: attachment.contentType,
    fileName: attachment.fileName,
    size: attachment.size ?? attachment.declaredSize,
  };
}

export function toSentAttachments(attachments: DraftAttachmentSummary[]) {
  return attachments.map(toSentAttachment);
}

export function getSentAttachmentCount(
  outbox: Pick<Doc<"outboxMessages">, "attachmentIds" | "sentAttachments">,
) {
  return outbox.sentAttachments?.length ?? outbox.attachmentIds?.length ?? 0;
}

export function getAccountLabel(
  account: Pick<
    Doc<"mailAccounts">,
    "address" | "displayLabel" | "displayName"
  >,
) {
  return (
    nonEmpty(account.displayLabel) ??
    nonEmpty(account.displayName) ??
    account.address
  );
}

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

/** A stored copy of a sent outbox message opens in the reader. */
export function canOpenStoredMessage(
  outbox: Pick<Doc<"outboxMessages">, "ownerId" | "status">,
  message: Pick<Doc<"messages">, "hiddenAt" | "ownerId"> | null | undefined,
): message is NonNullable<typeof message> {
  return (
    outbox.status === "sent" &&
    message?.ownerId === outbox.ownerId &&
    message.hiddenAt === undefined
  );
}
