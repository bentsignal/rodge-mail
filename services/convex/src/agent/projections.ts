import type {
  AgentSearchHit,
  AgentThreadMessage,
  MailboxAddress,
} from "@rodge-mail/agent-contract";
import {
  MAX_AGENT_MESSAGE_ATTACHMENTS,
  MAX_AGENT_MESSAGE_BODY_LENGTH,
  UNTRUSTED_MAIL_NOTICE,
} from "@rodge-mail/agent-contract";

import type { Doc } from "../_generated/dataModel";

export const untrustedMailContent = {
  isUntrusted: true,
  notice: UNTRUSTED_MAIL_NOTICE,
} as const;

export function projectAccount(account: Doc<"mailAccounts">) {
  return {
    id: account._id,
    provider: account.provider,
    address: bounded(account.address, 320),
    displayName: optionalBounded(account.displayName, 500),
    status: account.status,
    lastSyncedAt: account.lastSyncedAt,
  };
}

export function projectSearchHit(args: {
  account: Doc<"mailAccounts">;
  classification: Doc<"messageClassifications"> | null;
  matchKind: "lexical" | "semantic" | "both";
  message: Doc<"messages">;
  score?: number;
}) {
  const { account, classification, matchKind, message, score } = args;
  return {
    messageId: message._id,
    threadId: message.threadId,
    accountId: account._id,
    accountAddress: bounded(account.address, 320),
    direction: message.direction,
    from: projectAddress(message.from),
    to: message.to.slice(0, 100).map(projectAddress),
    subject: bounded(message.subject, 2_000),
    snippet: bounded(message.snippet, 2_000),
    receivedAt: Math.max(0, Math.floor(message.receivedAt)),
    isRead: message.isRead,
    isPinned: message.isPinned,
    hasAttachments: message.hasAttachments,
    importance: classification?.importance,
    category: classification?.category,
    classificationSummary: optionalBounded(classification?.summary, 280),
    matchKind,
    score: score === undefined ? undefined : clampScore(score),
  } satisfies AgentSearchHit;
}

export function projectThreadMessage(args: {
  attachments: Doc<"attachments">[];
  bodyBudget: number;
  message: Doc<"messages">;
  content: Doc<"messageContents"> | null;
  attachmentBudget: number;
}) {
  const { attachments, bodyBudget, message, content, attachmentBudget } = args;
  const sourceBody = content?.plainText;
  const bodyLimit = Math.max(
    0,
    Math.min(MAX_AGENT_MESSAGE_BODY_LENGTH, bodyBudget),
  );
  const plainText = sourceBody
    ? truncateUtf8(sourceBody, bodyLimit, MAX_AGENT_MESSAGE_BODY_LENGTH)
    : sourceBody;
  const contentTruncated =
    message.bodyState === "truncated" ||
    (sourceBody !== undefined && sourceBody !== plainText);
  const attachmentLimit = Math.max(
    0,
    Math.min(MAX_AGENT_MESSAGE_ATTACHMENTS, attachmentBudget),
  );
  const projectedAttachments = attachments
    .slice(0, attachmentLimit)
    .map((attachment) => ({
      fileName: bounded(attachment.fileName, 1_024),
      contentType: bounded(attachment.contentType, 255),
      size: Math.max(0, Math.floor(attachment.size)),
      status: attachment.status,
    }));
  const projected = {
    id: message._id,
    direction: message.direction,
    from: projectAddress(message.from),
    replyTo: message.replyTo?.slice(0, 100).map(projectAddress),
    to: message.to.slice(0, 100).map(projectAddress),
    cc: message.cc.slice(0, 100).map(projectAddress),
    bcc: message.bcc.slice(0, 100).map(projectAddress),
    subject: bounded(message.subject, 2_000),
    sentAt: optionalTimestamp(message.sentAt),
    receivedAt: Math.max(0, Math.floor(message.receivedAt)),
    bodyState: contentTruncated ? ("truncated" as const) : message.bodyState,
    plainText,
    contentTruncated,
    hasAttachments: message.hasAttachments,
    attachments: projectedAttachments,
    attachmentsTruncated: attachments.length > attachmentLimit,
  } satisfies AgentThreadMessage;
  return {
    message: projected,
    bodyBytes: plainText ? utf8Length(plainText) : 0,
    attachmentCount: projectedAttachments.length,
  };
}

function projectAddress(address: { address: string; name?: string }) {
  return {
    address: bounded(address.address, 320),
    name: optionalBounded(address.name, 500),
  } satisfies MailboxAddress;
}

function bounded(value: string, limit: number) {
  return value.slice(0, limit);
}

function optionalBounded(value: string | undefined, limit: number) {
  return value?.slice(0, limit);
}

function optionalTimestamp(value: number | undefined) {
  return value === undefined ? undefined : Math.max(0, Math.floor(value));
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function truncateUtf8(value: string, maxBytes: number, maxCharacters: number) {
  const bounded = value.slice(0, maxCharacters);
  if (utf8Length(bounded) <= maxBytes) return bounded;
  let lower = 0;
  let upper = bounded.length;
  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2);
    if (utf8Length(bounded.slice(0, middle)) <= maxBytes) lower = middle;
    else upper = middle - 1;
  }
  return bounded.slice(0, lower);
}

function utf8Length(value: string) {
  return new TextEncoder().encode(value).byteLength;
}
