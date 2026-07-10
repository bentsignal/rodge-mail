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
