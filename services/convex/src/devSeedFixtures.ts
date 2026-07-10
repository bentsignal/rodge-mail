import type {
  ClassificationCategory,
  FocusBucket,
  MailboxAddress,
  MailProvider,
} from "./mail/types";

export interface DemoAccount {
  key: "gmail" | "microsoft" | "icloud";
  provider: MailProvider;
  remoteAccountId: string;
  address: string;
  displayName: string;
}

export interface DemoAttachment {
  remoteAttachmentId: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface DemoMessage {
  account: DemoAccount["key"];
  remoteMessageId: string;
  remoteThreadId: string;
  internetMessageId: string;
  from: MailboxAddress;
  subject: string;
  snippet: string;
  body: string;
  receivedAt: number;
  isRead: boolean;
  isPinned: boolean;
  bucket: Exclude<FocusBucket, "unclassified">;
  category: ClassificationCategory;
  importance: number;
  confidence: number;
  reason: string;
  summary: string;
  shouldEmbed: boolean;
  attachment?: DemoAttachment;
}

export const DEMO_ACCOUNTS = [
  {
    key: "gmail",
    provider: "gmail",
    remoteAccountId: "demo-gmail-account",
    address: "shawn.demo@gmail.com",
    displayName: "Personal Gmail",
  },
  {
    key: "microsoft",
    provider: "microsoft",
    remoteAccountId: "demo-microsoft-account",
    address: "shawn@demo-company.com",
    displayName: "Work Microsoft 365",
  },
  {
    key: "icloud",
    provider: "icloud",
    remoteAccountId: "demo-icloud-account",
    address: "shawn.demo@icloud.com",
    displayName: "iCloud",
  },
] as const satisfies readonly DemoAccount[];

const JULY_9_2026 = Date.UTC(2026, 6, 9);
function hoursAgo(hours: number) {
  return JULY_9_2026 + 20 * 60 * 60 * 1000 - hours * 60 * 60 * 1000;
}

export const DEMO_MESSAGES = [
  {
    account: "gmail",
    remoteMessageId: "demo-gmail-order-shipped",
    remoteThreadId: "demo-gmail-order-thread",
    internetMessageId: "<order-shipped@demo.shop>",
    from: { address: "tracking@demo.shop", name: "Demo Shop" },
    subject: "Your order has shipped",
    snippet: "Your package is on the way and arrives tomorrow.",
    body: "Good news — order #1842 has shipped. It is scheduled to arrive tomorrow between 10 AM and 2 PM.",
    receivedAt: hoursAgo(1),
    isRead: false,
    isPinned: true,
    bucket: "focused",
    category: "transactional",
    importance: 0.91,
    confidence: 0.97,
    reason: "A time-sensitive delivery update Shawn is likely to act on.",
    summary: "Order #1842 arrives tomorrow between 10 AM and 2 PM.",
    shouldEmbed: true,
  },
  {
    account: "microsoft",
    remoteMessageId: "demo-ms-meeting-change",
    remoteThreadId: "demo-ms-meeting-thread",
    internetMessageId: "<meeting-change@demo-company.com>",
    from: { address: "maya@demo-company.com", name: "Maya Chen" },
    subject: "Can we move tomorrow's review?",
    snippet: "Could we start at 11 instead of 10?",
    body: "Hey Shawn, could we start tomorrow's product review at 11 instead of 10? I have a customer call that runs long. Thanks, Maya",
    receivedAt: hoursAgo(2),
    isRead: false,
    isPinned: false,
    bucket: "focused",
    category: "action_required",
    importance: 0.96,
    confidence: 0.99,
    reason: "A person Shawn works with asked a direct scheduling question.",
    summary: "Maya wants to move tomorrow's product review from 10 to 11.",
    shouldEmbed: true,
  },
  {
    account: "icloud",
    remoteMessageId: "demo-icloud-family",
    remoteThreadId: "demo-icloud-family-thread",
    internetMessageId: "<weekend-photos@family.demo>",
    from: { address: "dad@example.net", name: "Dad" },
    subject: "Photos from the weekend",
    snippet: "I finally copied over the photos from Sunday.",
    body: "I finally copied over the photos from Sunday. The one by the lake came out great. Give me a call when you get a chance.",
    receivedAt: hoursAgo(4),
    isRead: true,
    isPinned: true,
    bucket: "focused",
    category: "personal",
    importance: 0.94,
    confidence: 0.98,
    reason: "A personal message from a close contact.",
    summary: "Dad shared weekend photos and asked Shawn to call.",
    shouldEmbed: true,
    attachment: {
      remoteAttachmentId: "demo-weekend-photo",
      fileName: "lake.jpg",
      contentType: "image/jpeg",
      size: 842_194,
    },
  },
  {
    account: "microsoft",
    remoteMessageId: "demo-ms-invoice",
    remoteThreadId: "demo-ms-invoice-thread",
    internetMessageId: "<invoice-4401@vendor.demo>",
    from: { address: "billing@vendor.demo", name: "Demo Vendor" },
    subject: "Invoice 4401 is due Friday",
    snippet: "Please review invoice 4401 before Friday.",
    body: "Invoice 4401 for $286.00 is attached and due this Friday. Please reply if the billing details need to be changed.",
    receivedAt: hoursAgo(8),
    isRead: false,
    isPinned: false,
    bucket: "focused",
    category: "action_required",
    importance: 0.88,
    confidence: 0.95,
    reason: "The message contains a near-term payment deadline.",
    summary: "A $286 invoice needs review and payment by Friday.",
    shouldEmbed: true,
    attachment: {
      remoteAttachmentId: "demo-invoice-pdf",
      fileName: "invoice-4401.pdf",
      contentType: "application/pdf",
      size: 92_410,
    },
  },
  {
    account: "gmail",
    remoteMessageId: "demo-gmail-security",
    remoteThreadId: "demo-gmail-security-thread",
    internetMessageId: "<security-alert@developer.demo>",
    from: { address: "security@developer.demo", name: "Developer Tools" },
    subject: "A new sign-in needs your review",
    snippet: "A new device signed in to your account.",
    body: "A new device signed in from Richmond, Virginia. If this was not you, revoke the session and rotate your credentials.",
    receivedAt: hoursAgo(12),
    isRead: true,
    isPinned: false,
    bucket: "focused",
    category: "action_required",
    importance: 0.9,
    confidence: 0.94,
    reason: "An account security event may need immediate review.",
    summary: "Review a new sign-in from Richmond and revoke it if unfamiliar.",
    shouldEmbed: true,
  },
  {
    account: "icloud",
    remoteMessageId: "demo-icloud-receipt",
    remoteThreadId: "demo-icloud-receipt-thread",
    internetMessageId: "<receipt@apple-demo.example>",
    from: { address: "receipts@apple-demo.example", name: "App Store" },
    subject: "Your receipt from Apple",
    snippet: "Receipt for your monthly storage plan.",
    body: "Your monthly storage plan renewed for $2.99. No action is required.",
    receivedAt: hoursAgo(20),
    isRead: true,
    isPinned: false,
    bucket: "other",
    category: "transactional",
    importance: 0.38,
    confidence: 0.96,
    reason: "A routine receipt with no action required.",
    summary: "The monthly storage plan renewed for $2.99.",
    shouldEmbed: false,
  },
  {
    account: "gmail",
    remoteMessageId: "demo-gmail-newsletter",
    remoteThreadId: "demo-gmail-newsletter-thread",
    internetMessageId: "<weekly-digest@design.demo>",
    from: { address: "digest@design.demo", name: "Design Weekly" },
    subject: "This week in product design",
    snippet: "Seven links about buttons, typography, and motion.",
    body: "This week's collection covers buttons, typography systems, motion studies, and an interview with a design systems lead.",
    receivedAt: hoursAgo(30),
    isRead: false,
    isPinned: false,
    bucket: "other",
    category: "newsletter",
    importance: 0.22,
    confidence: 0.98,
    reason: "A recurring newsletter without a direct request.",
    summary: "A weekly collection of product design links.",
    shouldEmbed: false,
  },
  {
    account: "microsoft",
    remoteMessageId: "demo-ms-digest",
    remoteThreadId: "demo-ms-digest-thread",
    internetMessageId: "<activity-digest@demo-company.com>",
    from: { address: "activity@demo-company.com", name: "Workplace Activity" },
    subject: "You have 14 unread notifications",
    snippet: "Here's what happened while you were away.",
    body: "You have 14 unread channel notifications and 3 reactions. Open the workplace app to review them.",
    receivedAt: hoursAgo(36),
    isRead: false,
    isPinned: false,
    bucket: "other",
    category: "notification",
    importance: 0.16,
    confidence: 0.99,
    reason:
      "A bulk activity digest duplicates information available elsewhere.",
    summary: "A workplace digest reports 14 unread notifications.",
    shouldEmbed: false,
  },
  {
    account: "gmail",
    remoteMessageId: "demo-gmail-policy",
    remoteThreadId: "demo-gmail-policy-thread",
    internetMessageId: "<privacy-update@streaming.demo>",
    from: { address: "legal@streaming.demo", name: "Streaming Service" },
    subject: "We've updated our privacy policy",
    snippet: "Our privacy policy changes take effect next month.",
    body: "We updated our privacy policy to clarify data retention and regional service providers. No action is required.",
    receivedAt: hoursAgo(48),
    isRead: true,
    isPinned: false,
    bucket: "other",
    category: "noise",
    importance: 0.04,
    confidence: 0.99,
    reason: "A generic policy update with no action required.",
    summary: "A streaming service updated its privacy policy.",
    shouldEmbed: false,
  },
] as const satisfies readonly DemoMessage[];
