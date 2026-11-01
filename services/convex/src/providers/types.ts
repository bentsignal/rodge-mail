import type { Id } from "../_generated/dataModel";
import type { MailboxAddress, MailFolderKind } from "../mail/types";

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: number;
  scopes: string[];
}

export interface NormalizedFolder {
  remoteFolderId: string;
  name: string;
  kind: MailFolderKind;
}

export interface NormalizedAttachment {
  remoteAttachmentId: string;
  fileName: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentId?: string;
}

export interface NormalizedMessage {
  remoteMessageId: string;
  remoteThreadId: string;
  internetMessageId?: string;
  from: MailboxAddress;
  replyTo?: MailboxAddress[];
  to: MailboxAddress[];
  cc: MailboxAddress[];
  bcc: MailboxAddress[];
  subject: string;
  snippet: string;
  plainText?: string;
  sanitizedHtml?: string;
  headers: { name: string; value: string }[];
  remoteLabelIds: string[];
  sentAt?: number;
  receivedAt: number;
  hasAttachments: boolean;
  inInbox: boolean;
  isRead: boolean;
  direction: "incoming" | "outgoing";
  attachments: NormalizedAttachment[];
}

export interface OutboxPayload {
  _id: Id<"outboxMessages">;
  accountId: Id<"mailAccounts">;
  remoteMessageId?: string;
  from: string;
  to: MailboxAddress[];
  cc: MailboxAddress[];
  bcc: MailboxAddress[];
  subject: string;
  plainText: string;
  replyToInternetMessageId?: string;
  replyToRemoteMessageId?: string;
  replyToRemoteThreadId?: string;
  attachments: OutboxAttachmentPayload[];
}

export interface OutboxAttachmentPayload {
  fileName: string;
  contentType: string;
  size: number;
  bytes: Uint8Array;
}

export interface SyncResult {
  cursor: string;
  upserted: number;
  deleted: number;
  mode: "full" | "incremental";
}

export interface MailProviderAdapter {
  fullSync(accessToken: string): Promise<{
    cursor: string;
    folders: NormalizedFolder[];
    messages: NormalizedMessage[];
  }>;
  incrementalSync(
    accessToken: string,
    cursor: string,
  ): Promise<{
    cursor: string;
    deletedRemoteMessageIds: string[];
    messages: NormalizedMessage[];
  }>;
  sendMessage(
    accessToken: string,
    payload: OutboxPayload,
  ): Promise<{ remoteMessageId: string }>;
  fetchAttachment(
    accessToken: string,
    remoteMessageId: string,
    remoteAttachmentId: string,
  ): Promise<Uint8Array>;
}

export type ImportFolderKind = "inbox" | "sent" | "archive" | "junk" | "custom";

export interface ImportFolder {
  kind: ImportFolderKind;
  path: string;
}

export interface ImportSourceMessage {
  remoteMessageId: string;
  folder: ImportFolder;
  isRead: boolean;
  receivedAt?: number;
}

/**
 * Reads a connected account's mail as raw RFC 5322 messages. `cursor` is
 * opaque to callers; `nextCursor` is null once every folder is exhausted.
 */
export interface MailImportSource {
  listMessages(
    cursor: string | undefined,
    limit: number,
  ): Promise<{
    messages: ImportSourceMessage[];
    nextCursor: string | null;
    estimatedTotal?: number;
  }>;
  fetchRawMessage(remoteMessageId: string): Promise<Uint8Array>;
}
