/* eslint-disable complexity -- RFC 5322 normalization deliberately handles absent and partial message fields. */
import { createHash } from "node:crypto";
import type {
  FetchMessageObject,
  ListResponse,
  MessageAddressObject,
} from "imapflow";
import { simpleParser } from "mailparser";

import type { NormalizedICloudMessage } from "@rodge-mail/convex/providers/icloud/contract";

import type { BridgeAccount } from "./database";

const MAX_TEXT_LENGTH = 100_000;

export async function normalizeMessage(
  account: BridgeAccount,
  mailbox: ListResponse,
  uidValidity: string,
  message: FetchMessageObject,
) {
  const parsed = await simpleParser(message.source ?? Buffer.alloc(0));
  const direction = mailboxKind(mailbox) === "sent" ? "outgoing" : "incoming";
  const receivedAt = new Date(
    parsed.date ?? message.envelope?.date ?? message.internalDate ?? Date.now(),
  ).getTime();
  const internetMessageId = message.envelope?.messageId;
  const remoteMessageId = createRemoteMessageId(
    mailbox.path,
    uidValidity,
    message.uid,
  );
  const plainText = parsed.text?.slice(0, MAX_TEXT_LENGTH);
  const snippet = collapseWhitespace(plainText ?? parsed.subject ?? "").slice(
    0,
    500,
  );
  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? [parsed.references]
      : [];
  return {
    remoteMessageId,
    remoteThreadId: createThreadId(
      references[0] ?? message.envelope?.inReplyTo ?? internetMessageId,
      parsed.subject,
    ),
    internetMessageId,
    from: toAddresses(message.envelope?.from)[0] ?? {
      address: account.address,
    },
    replyTo: optionalAddresses(message.envelope?.replyTo),
    to: toAddresses(message.envelope?.to),
    cc: toAddresses(message.envelope?.cc),
    bcc: toAddresses(message.envelope?.bcc),
    subject: parsed.subject ?? message.envelope?.subject ?? "(no subject)",
    snippet,
    plainText,
    headers: parsed.headerLines.slice(0, 500).map((header) => ({
      name: header.key,
      value: header.line.slice(header.line.indexOf(":") + 1).trim(),
    })),
    remoteLabelIds: [mailbox.path],
    sentAt: direction === "outgoing" ? receivedAt : undefined,
    receivedAt,
    hasAttachments: parsed.attachments.length > 0,
    inInbox: mailboxKind(mailbox) === "inbox",
    isRead: message.flags?.has("\\Seen") ?? false,
    direction,
    attachments: parsed.attachments.map((attachment, index) => ({
      remoteAttachmentId: `${remoteMessageId}:${attachment.checksum || index}`,
      fileName: attachment.filename ?? `attachment-${index + 1}`,
      contentType: attachment.contentType,
      size: attachment.size,
      isInline:
        attachment.contentDisposition === "inline" ||
        attachment.related === true,
      contentId: attachment.contentId,
    })),
  } satisfies NormalizedICloudMessage;
}

export function isSelectableMailbox(mailbox: ListResponse) {
  return !mailbox.flags.has("\\Noselect");
}

export function toNormalizedFolder(mailbox: ListResponse) {
  return {
    remoteFolderId: mailbox.path,
    name: mailbox.name,
    kind: mailboxKind(mailbox),
  };
}

function mailboxKind(mailbox: ListResponse) {
  const specialUse = mailbox.specialUse?.toLowerCase();
  if (mailbox.path.toUpperCase() === "INBOX" || specialUse === "\\inbox") {
    return "inbox" as const;
  }
  if (specialUse === "\\sent") return "sent" as const;
  if (specialUse === "\\drafts") return "drafts" as const;
  if (specialUse === "\\archive" || specialUse === "\\all") {
    return "archive" as const;
  }
  if (specialUse === "\\trash") return "trash" as const;
  if (specialUse === "\\junk") return "junk" as const;
  return "custom" as const;
}

function toAddresses(addresses: MessageAddressObject[] | undefined) {
  return (addresses ?? [])
    .filter((address) => Boolean(address.address?.includes("@")))
    .map((address) => ({
      address: address.address?.toLowerCase() ?? "",
      name: address.name ?? undefined,
    }));
}

function optionalAddresses(addresses: MessageAddressObject[] | undefined) {
  const normalized = toAddresses(addresses);
  return normalized.length > 0 ? normalized : undefined;
}

function createRemoteMessageId(
  mailbox: string,
  uidValidity: string,
  uid: number,
) {
  return `imap:${Buffer.from(mailbox).toString("base64url")}:${uidValidity}:${uid}`;
}

function createThreadId(
  reference: string | undefined,
  subject: string | undefined,
) {
  const source = reference ?? normalizeSubject(subject ?? "(no subject)");
  return `rfc822:${createHash("sha256").update(source).digest("base64url")}`;
}

function normalizeSubject(subject: string) {
  return subject
    .replace(/^(?:(?:re|fw|fwd):\s*)+/iu, "")
    .trim()
    .toLowerCase();
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}
