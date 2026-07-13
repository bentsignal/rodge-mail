export type MailAccountId = string;

export type MailAccountFilter = string;

export type MailProvider = "gmail" | "icloud" | "microsoft";

export interface MailAddress {
  address: string;
  name: string;
}

export interface MailAccount {
  accent: string;
  address: string;
  id: MailAccountId;
  initials: string;
  label: string;
  provider: MailProvider;
}

export interface MailAttachment {
  contentType?: string;
  id: string;
  name: string;
  size: string;
  status: "available" | "error" | "remote";
  type: "document" | "image" | "spreadsheet";
}

export interface MailMessage {
  attachments: MailAttachment[];
  body: string[];
  cleanedBody?: string;
  cc: MailAddress[];
  from: MailAddress;
  id: string;
  internetMessageId?: string;
  isSpam?: boolean;
  originalHtml?: string;
  overview?: string;
  replyTo?: MailAddress[];
  sentAt: string;
  to: MailAddress[];
}

export interface MailThread {
  accountId: MailAccountId;
  id: string;
  isPinned: boolean;
  isRead: boolean;
  messages: MailMessage[];
  preview: string;
  receivedAt: string;
  sender: MailAddress;
  subject: string;
}

export interface ComposerAttachment {
  contentType: string;
  draftAttachmentId?: string;
  error?: string;
  fileName: string;
  id: string;
  size: number;
  status: "error" | "ready" | "uploading";
}

export interface ComposerDraft<
  TAttachment extends ComposerAttachment = ComposerAttachment,
> {
  attachments: TAttachment[];
  bcc: string;
  body: string;
  cc: string;
  subject: string;
  to: string;
}
