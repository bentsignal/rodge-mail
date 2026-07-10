export type MailAccountId = string;

export type MailAccountFilter = string;

export type InboxCategory = "focused" | "other";

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
  id: string;
  name: string;
  size: string;
  type: "document" | "image" | "spreadsheet";
}

export interface MailMessage {
  attachments: MailAttachment[];
  body: string[];
  cc: MailAddress[];
  from: MailAddress;
  id: string;
  sentAt: string;
  to: MailAddress[];
}

export interface MailThread {
  accountId: MailAccountId;
  category: InboxCategory;
  id: string;
  isPinned: boolean;
  isRead: boolean;
  messages: MailMessage[];
  preview: string;
  priorityNote?: string;
  receivedAt: string;
  sender: MailAddress;
  subject: string;
}

export interface ComposerDraft {
  attachments: string[];
  body: string;
  cc: string;
  subject: string;
  to: string;
}
