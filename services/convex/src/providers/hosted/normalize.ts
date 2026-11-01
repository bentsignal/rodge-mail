"use node";

/* eslint-disable complexity -- RFC 5322 normalization deliberately handles absent and partial message fields. */
import type { AddressObject, ParsedMail } from "mailparser";
import { simpleParser } from "mailparser";

import type { MailboxAddress } from "../../mail/types";
import type { NormalizedMessage } from "../types";
import { sanitizeEmailHtml } from "../../mail/html";
import { createThreadId } from "../icloud/identifiers";
import { hostedAttachmentId } from "./addresses";

const MAX_TEXT_LENGTH = 100_000;

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
  const plainText = parsed.text?.slice(0, MAX_TEXT_LENGTH);
  const sanitizedHtml = sanitizeEmailHtml(
    typeof parsed.html === "string"
      ? parsed.html.slice(0, MAX_TEXT_LENGTH)
      : undefined,
  );
  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? [parsed.references]
      : [];
  const outgoing = args.direction === "outgoing";
  return {
    remoteMessageId: args.remoteMessageId,
    remoteThreadId:
      args.remoteThreadId ??
      createThreadId(
        references.at(0) ?? parsed.inReplyTo ?? internetMessageId,
        parsed.subject,
      ),
    internetMessageId,
    from: toAddresses(parsed.from)[0] ?? { address: args.fallbackFrom },
    replyTo: optionalAddresses(parsed.replyTo),
    to: toAddresses(parsed.to),
    cc: toAddresses(parsed.cc),
    bcc: toAddresses(parsed.bcc),
    subject: parsed.subject ?? "(no subject)",
    snippet: collapseWhitespace(plainText ?? parsed.subject ?? "").slice(
      0,
      500,
    ),
    plainText,
    sanitizedHtml,
    headers: parsed.headerLines.slice(0, 500).map((header) => ({
      name: header.key,
      value: header.line.slice(header.line.indexOf(":") + 1).trim(),
    })),
    remoteLabelIds: args.labelIds ?? [
      outgoing ? "sent" : args.junk ? "junk" : "inbox",
    ],
    sentAt: outgoing ? args.receivedAt : parsed.date?.getTime(),
    receivedAt: args.receivedAt,
    hasAttachments: parsed.attachments.length > 0,
    inInbox: args.inInbox ?? (!outgoing && !args.junk),
    isRead: args.isRead ?? outgoing,
    direction: args.direction,
    attachments: parsed.attachments.map((attachment, index) => ({
      remoteAttachmentId: hostedAttachmentId(args.remoteMessageId, index),
      fileName: attachment.filename ?? `attachment-${index + 1}`,
      contentType: attachment.contentType,
      size: attachment.size,
      isInline:
        attachment.contentDisposition === "inline" ||
        attachment.related === true,
      contentId: attachment.contentId,
    })),
  } satisfies NormalizedMessage;
}

function toAddresses(value: AddressObject | AddressObject[] | undefined) {
  const groups = Array.isArray(value) ? value : value ? [value] : [];
  return groups
    .flatMap((group) => group.value)
    .flatMap((entry) => [entry, ...(entry.group ?? [])])
    .filter((entry) => Boolean(entry.address?.includes("@")))
    .map(
      (entry): MailboxAddress => ({
        address: entry.address?.toLowerCase() ?? "",
        name: entry.name ? entry.name : undefined,
      }),
    );
}

function optionalAddresses(value: AddressObject | AddressObject[] | undefined) {
  const addresses = toAddresses(value);
  return addresses.length > 0 ? addresses : undefined;
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}
