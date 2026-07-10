import { v } from "convex/values";

export const vMailProvider = v.union(
  v.literal("gmail"),
  v.literal("microsoft"),
  v.literal("icloud"),
);

export const vMailAccountStatus = v.union(
  v.literal("connected"),
  v.literal("syncing"),
  v.literal("error"),
  v.literal("reauthorization_required"),
  v.literal("disconnected"),
);

export const vMailFolderKind = v.union(
  v.literal("inbox"),
  v.literal("sent"),
  v.literal("drafts"),
  v.literal("archive"),
  v.literal("trash"),
  v.literal("junk"),
  v.literal("custom"),
);

export const vMailboxAddress = v.object({
  address: v.string(),
  name: v.optional(v.string()),
});

export const vMessageHeader = v.object({
  name: v.string(),
  value: v.string(),
});

export const vFocusBucket = v.union(
  v.literal("focused"),
  v.literal("other"),
  v.literal("unclassified"),
);

export const vMessageDirection = v.union(
  v.literal("incoming"),
  v.literal("outgoing"),
);

export const vMessageBodyState = v.union(
  v.literal("available"),
  v.literal("remote"),
  v.literal("truncated"),
);

export const vMailAccount = v.object({
  ownerId: v.string(),
  provider: vMailProvider,
  remoteAccountId: v.string(),
  address: v.string(),
  displayName: v.optional(v.string()),
  status: vMailAccountStatus,
  isDemo: v.optional(v.boolean()),
  syncCursor: v.optional(v.string()),
  grantedScopes: v.optional(v.array(v.string())),
  credentialKeyVersion: v.optional(v.string()),
  connectedAt: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
  lastSyncError: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vMailFolder = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  remoteFolderId: v.string(),
  name: v.string(),
  kind: vMailFolderKind,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vThread = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  remoteThreadId: v.string(),
  subject: v.string(),
  snippet: v.string(),
  participants: v.array(vMailboxAddress),
  latestMessageAt: v.number(),
  messageCount: v.number(),
  unreadCount: v.number(),
  hasAttachments: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vMessage = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  threadId: v.id("threads"),
  remoteMessageId: v.string(),
  internetMessageId: v.optional(v.string()),
  direction: vMessageDirection,
  from: vMailboxAddress,
  replyTo: v.optional(v.array(vMailboxAddress)),
  to: v.array(vMailboxAddress),
  cc: v.array(vMailboxAddress),
  bcc: v.array(vMailboxAddress),
  subject: v.string(),
  snippet: v.string(),
  searchText: v.string(),
  headers: v.optional(v.array(vMessageHeader)),
  remoteLabelIds: v.optional(v.array(v.string())),
  bodyState: vMessageBodyState,
  sentAt: v.optional(v.number()),
  receivedAt: v.number(),
  hasAttachments: v.boolean(),
  inInbox: v.boolean(),
  isRead: v.boolean(),
  isPinned: v.boolean(),
  focusBucket: vFocusBucket,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vMessageContent = v.object({
  ownerId: v.string(),
  messageId: v.id("messages"),
  plainText: v.optional(v.string()),
  sanitizedHtml: v.optional(v.string()),
  htmlStorageId: v.optional(v.id("_storage")),
  rawStorageId: v.optional(v.id("_storage")),
  truncated: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vAttachmentStatus = v.union(
  v.literal("remote"),
  v.literal("available"),
  v.literal("error"),
);

export const vAttachment = v.object({
  ownerId: v.string(),
  messageId: v.id("messages"),
  remoteAttachmentId: v.string(),
  fileName: v.string(),
  contentType: v.string(),
  size: v.number(),
  isInline: v.boolean(),
  contentId: v.optional(v.string()),
  status: vAttachmentStatus,
  storageId: v.optional(v.id("_storage")),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vClassificationStatus = v.union(
  v.literal("pending"),
  v.literal("classified"),
  v.literal("failed"),
);

export const vClassificationCategory = v.union(
  v.literal("personal"),
  v.literal("action_required"),
  v.literal("transactional"),
  v.literal("newsletter"),
  v.literal("notification"),
  v.literal("noise"),
);

export const vClassificationSource = v.union(
  v.literal("seed"),
  v.literal("rules"),
  v.literal("model"),
  v.literal("manual"),
);

export const vMessageClassification = v.object({
  ownerId: v.string(),
  messageId: v.id("messages"),
  status: vClassificationStatus,
  bucket: vFocusBucket,
  category: v.optional(vClassificationCategory),
  importance: v.number(),
  confidence: v.number(),
  reason: v.optional(v.string()),
  summary: v.optional(v.string()),
  shouldEmbed: v.boolean(),
  source: vClassificationSource,
  promptVersion: v.string(),
  model: v.optional(v.string()),
  error: v.optional(v.string()),
  classifiedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vSyncReason = v.union(
  v.literal("initial"),
  v.literal("incremental"),
  v.literal("manual"),
  v.literal("reconcile"),
);

export const vSyncStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
);

export const vSyncRun = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  reason: vSyncReason,
  status: vSyncStatus,
  cursor: v.optional(v.string()),
  attempt: v.number(),
  error: v.optional(v.string()),
  createdAt: v.number(),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  updatedAt: v.number(),
});

export const vEncryptedEnvelope = v.object({
  formatVersion: v.literal(1),
  keyVersion: v.string(),
  iv: v.string(),
  ciphertext: v.string(),
});

export const vProviderCredential = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  provider: vMailProvider,
  encryptedTokens: vEncryptedEnvelope,
  tokenExpiresAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vProviderOAuthState = v.object({
  ownerId: v.string(),
  provider: vMailProvider,
  stateHash: v.string(),
  encryptedCodeVerifier: vEncryptedEnvelope,
  returnPath: v.string(),
  expiresAt: v.number(),
  createdAt: v.number(),
});

export const vOutboxStatus = v.union(
  v.literal("pending"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("failed"),
);

export const vOutboxMessage = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  idempotencyKey: v.string(),
  to: v.array(vMailboxAddress),
  cc: v.array(vMailboxAddress),
  bcc: v.array(vMailboxAddress),
  subject: v.string(),
  plainText: v.string(),
  replyToInternetMessageId: v.optional(v.string()),
  status: vOutboxStatus,
  attempt: v.number(),
  leaseId: v.optional(v.string()),
  remoteMessageId: v.optional(v.string()),
  error: v.optional(v.string()),
  sentAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
