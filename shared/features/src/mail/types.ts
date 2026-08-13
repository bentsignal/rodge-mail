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
  contentId?: string;
  contentType?: string;
  id: string;
  isInline?: boolean;
  name: string;
  size: string;
  status: "available" | "error" | "remote";
  type: "document" | "image" | "spreadsheet";
}

export interface MailMessage {
  attachments: MailAttachment[];
  body: string[];
  cleanedBody?: string;
  cleanCode?: {
    label: string;
    value: string;
  };
  cleanError?: string;
  cleanStatus?: "pending" | "running" | "ready" | "failed";
  cc: MailAddress[];
  from: MailAddress;
  id: string;
  internetMessageId?: string;
  isSpam?: boolean;
  mailingList?: {
    displayName: string;
    remoteMethod: "one_click" | "email" | "none";
  };
  originalHtml?: string;
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
