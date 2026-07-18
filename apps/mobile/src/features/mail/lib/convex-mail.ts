import type { FunctionReturnType } from "convex/server";

import type { api } from "@rodge-mail/convex/api";
import type { MailAccount, MailAttachment } from "@rodge-mail/features/mail";
import {
  dedupeThreadRows,
  sortPinnedMailRows,
} from "@rodge-mail/features/mail";

const attachmentTypes = {
  document: "document",
  image: "image",
  spreadsheet: "spreadsheet",
} satisfies Record<string, MailAttachment["type"]>;

type InboxResult = FunctionReturnType<typeof api.mail.queries.listInbox>;
type InboxItem = InboxResult["page"][number];
type ThreadDetail = FunctionReturnType<typeof api.mail.queries.getThread>;
type ThreadMessage = ThreadDetail["messages"][number];
type Account = FunctionReturnType<typeof api.accounts.queries.list>[number];

export type MobileMailAccount = MailAccount & {
  displayLabel: Account["displayLabel"];
  displayName: Account["displayName"];
  isDemo: boolean;
  lastSyncError: string | undefined;
  lastSyncedAt: number | undefined;
  status: Account["status"];
};

export function toMailThread(item: InboxItem) {
  return {
    accountId: item.accountId,
    id: item.threadId,
    isPinned: item.isPinned,
    isRead: item.isRead,
    messages: [],
    preview: item.classification?.summary ?? item.snippet,
    receivedAt: new Date(item.receivedAt).toISOString(),
    sender: {
      address: item.from.address,
      name: getAddressName(item.from),
    },
    subject: item.subject,
  };
}

export function toMailThreads(items: InboxItem[]) {
  return sortPinnedMailRows(dedupeThreadRows(items).map(toMailThread));
}

export function toMailThreadDetail(item: ThreadDetail) {
  const latest = item.messages.at(-1);
  if (!latest) throw new Error("Mail thread has no messages");
  return {
    accountId: item.accountId,
    id: item._id,
    isPinned: item.messages.some((message) => message.isPinned),
    isRead: item.unreadCount === 0,
    messages: item.messages.map(toMailMessage),
    preview: latest.classification?.summary ?? latest.snippet,
    receivedAt: new Date(latest.receivedAt).toISOString(),
    sender: {
      address: latest.from.address,
      name: getAddressName(latest.from),
    },
    subject: item.subject,
  };
}

export function toMailAccount(account: Account) {
  const providerLabel = getNonemptyValue(account.displayName, account.address);
  const label = getNonemptyValue(account.displayLabel, providerLabel);
  return {
    accent: getProviderAccent(account.provider),
    address: account.address,
    displayLabel: account.displayLabel,
    displayName: account.displayName,
    id: account._id,
    initials: getInitials(label),
    isDemo: account.isDemo ?? false,
    label,
    lastSyncError: account.lastSyncError,
    lastSyncedAt: account.lastSyncedAt,
    provider: account.provider,
    status: account.status,
  };
}

function toMailMessage(item: ThreadMessage) {
  return {
    attachments: item.attachments.map(toMailAttachment),
    body: toParagraphs(item.content?.plainText, item.snippet),
    cleanedBody: item.cleanView?.cleanedMarkdown,
    cleanError: item.cleanView?.error,
    cleanStatus: item.cleanView?.status,
    cc: item.cc.map((address) => ({
      address: address.address,
      name: getAddressName(address),
    })),
    from: {
      address: item.from.address,
      name: getAddressName(item.from),
    },
    id: item._id,
    internetMessageId: item.internetMessageId,
    isSpam: item.classification?.isSpam,
    originalHtml: item.content?.sanitizedHtml,
    overview: item.cleanView?.summary,
    replyTo: item.replyTo?.map((address) => ({
      address: address.address,
      name: getAddressName(address),
    })),
    sentAt: new Date(item.sentAt ?? item.receivedAt).toISOString(),
    to: item.to.map((address) => ({
      address: address.address,
      name: getAddressName(address),
    })),
  };
}

function toMailAttachment(attachment: ThreadMessage["attachments"][number]) {
  return {
    contentType: attachment.contentType,
    id: attachment._id,
    name: attachment.fileName,
    size: formatByteSize(attachment.size),
    status: attachment.status,
    type: getAttachmentType(attachment.contentType),
  };
}

function getAddressName(address: { address: string; name?: string }) {
  return getNonemptyValue(address.name, address.address);
}

function toParagraphs(plainText: string | undefined, fallback: string) {
  const source = getNonemptyValue(plainText, fallback);
  return source
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getProviderAccent(provider: Account["provider"]) {
  if (provider === "gmail") return "#c95d3f";
  if (provider === "microsoft") return "#397367";
  return "#b38736";
}

function getInitials(value: string) {
  return value
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase())
    .join("");
}

function getAttachmentType(contentType: string) {
  if (contentType.startsWith("image/")) return attachmentTypes.image;
  if (contentType.includes("sheet") || contentType.includes("excel")) {
    return attachmentTypes.spreadsheet;
  }
  return attachmentTypes.document;
}

function getNonemptyValue(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  if (normalized) return normalized;
  return fallback;
}

function formatByteSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
