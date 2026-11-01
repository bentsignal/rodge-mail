"use node";

/* eslint-disable complexity -- RFC 5322 normalization deliberately handles absent and partial message fields. */
import type { AddressObject, ParsedMail } from "mailparser";
import { simpleParser } from "mailparser";

import type { MailboxAddress } from "../../mail/types";
import type { NormalizedMessage } from "../types";
import { sanitizeEmailHtml } from "../../mail/html";
import { toWellFormed, truncateText } from "../../mail/text";
import { createThreadId } from "../icloud/identifiers";
import { hostedAttachmentId } from "./addresses";

const MAX_TEXT_LENGTH = 100_000;
const MAX_SUBJECT_LENGTH = 2_000;
const MAX_ADDRESSES = 500;
const MAX_HEADERS = 500;
const MAX_HEADER_VALUE_LENGTH = 4_000;
const MAX_HEADERS_LENGTH = 64_000;

export async function parseRawMessage(raw: Uint8Array) {
  return await simpleParser(Buffer.from(raw));
}

export function normalizeHostedMessage(
  parsed: ParsedMail,
  args: {
    remoteMessageId: string;
    remoteThreadId?: string;
    internetMessageId?: string;
    direction: "incoming" | "outgoing";
    fallbackFrom: string;
    receivedAt: number;
    junk: boolean;
    labelIds?: string[];
    inInbox?: boolean;
    isRead?: boolean;
  },
) {
  const internetMessageId = args.internetMessageId ?? parsed.messageId;
  const plainText = optionalText(parsed.text, MAX_TEXT_LENGTH);
  const sanitizedHtml = sanitizeEmailHtml(
    typeof parsed.html === "string"
      ? truncateText(parsed.html, MAX_TEXT_LENGTH)
      : undefined,
  );
  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? [parsed.references]
      : [];
  const outgoing = args.direction === "outgoing";
  const subject = optionalText(parsed.subject, MAX_SUBJECT_LENGTH);
  return {
    remoteMessageId: args.remoteMessageId,
    remoteThreadId:
      args.remoteThreadId ??
      createThreadId(
        references.at(0) ?? parsed.inReplyTo ?? internetMessageId,
        parsed.subject,
      ),
    internetMessageId: optionalText(internetMessageId, MAX_HEADER_VALUE_LENGTH),
    from: toAddresses(parsed.from)[0] ?? { address: args.fallbackFrom },
    replyTo: optionalAddresses(parsed.replyTo),
    to: toAddresses(parsed.to),
    cc: toAddresses(parsed.cc),
    bcc: toAddresses(parsed.bcc),
    subject: subject ?? "(no subject)",
    snippet: truncateText(collapseWhitespace(plainText ?? subject ?? ""), 500),
    plainText,
    sanitizedHtml: sanitizedHtml && toWellFormed(sanitizedHtml),
    headers: toHeaders(parsed.headerLines),
    remoteLabelIds: args.labelIds ?? [
      outgoing ? "sent" : args.junk ? "junk" : "inbox",
    ],
    sentAt: outgoing ? args.receivedAt : finiteTime(parsed.date),
    receivedAt: args.receivedAt,
    hasAttachments: parsed.attachments.length > 0,
    inInbox: args.inInbox ?? (!outgoing && !args.junk),
    isRead: args.isRead ?? outgoing,
    direction: args.direction,
    attachments: parsed.attachments.map((attachment, index) => ({
      remoteAttachmentId: hostedAttachmentId(args.remoteMessageId, index),
      fileName:
        optionalText(attachment.filename, 500) ?? `attachment-${index + 1}`,
      contentType:
        optionalText(attachment.contentType, 255) ?? "application/octet-stream",
      size: Number.isFinite(attachment.size) ? attachment.size : 0,
      isInline:
        attachment.contentDisposition === "inline" ||
        attachment.related === true,
      contentId: optionalText(attachment.contentId, 1_000),
    })),
  } satisfies NormalizedMessage;
}

function toAddresses(value: AddressObject | AddressObject[] | undefined) {
  const groups = Array.isArray(value) ? value : value ? [value] : [];
  return groups
    .flatMap((group) => group.value)
    .flatMap((entry) => [entry, ...(entry.group ?? [])])
    .filter((entry) => Boolean(entry.address?.includes("@")))
    .slice(0, MAX_ADDRESSES)
    .map(
      (entry): MailboxAddress => ({
        address: toWellFormed(entry.address?.toLowerCase() ?? ""),
        name: optionalText(entry.name, 500),
      }),
    );
}

function optionalAddresses(value: AddressObject | AddressObject[] | undefined) {
  const addresses = toAddresses(value);
  return addresses.length > 0 ? addresses : undefined;
}

// mailparser leaves headerLines unset when the header block is over 1 MB.
function toHeaders(lines: ParsedMail["headerLines"] | undefined) {
  const headers = new Array<{ name: string; value: string }>();
  let length = 0;
  for (const line of (lines ?? []).slice(0, MAX_HEADERS)) {
    const name = truncateText(toWellFormed(line.key), 200);
    const value = truncateText(
      toWellFormed(line.line.slice(line.line.indexOf(":") + 1).trim()),
      MAX_HEADER_VALUE_LENGTH,
    );
    if (length + name.length + value.length > MAX_HEADERS_LENGTH) continue;
    length += name.length + value.length;
    headers.push({ name, value });
  }
  return headers;
}

function optionalText(value: string | undefined, maxLength: number) {
  return value ? truncateText(toWellFormed(value), maxLength) : undefined;
}

function finiteTime(date: Date | undefined) {
  const time = date?.getTime();
  return time !== undefined && Number.isFinite(time) ? time : undefined;
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}
