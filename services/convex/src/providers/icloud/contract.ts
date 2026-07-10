import { z } from "zod";

const mailboxAddressSchema = z
  .object({
    address: z.string().email().max(320),
    name: z.string().max(300).optional(),
  })
  .strict();

const attachmentSchema = z
  .object({
    remoteAttachmentId: z.string().min(1).max(500),
    fileName: z.string().max(500),
    contentType: z.string().max(200),
    size: z.number().int().nonnegative(),
    isInline: z.boolean(),
    contentId: z.string().max(500).optional(),
  })
  .strict();

export const normalizedICloudMessageSchema = z
  .object({
    remoteMessageId: z.string().min(1).max(1_000),
    remoteThreadId: z.string().min(1).max(1_000),
    internetMessageId: z.string().max(1_000).optional(),
    from: mailboxAddressSchema,
    replyTo: z.array(mailboxAddressSchema).max(100).optional(),
    to: z.array(mailboxAddressSchema).max(500),
    cc: z.array(mailboxAddressSchema).max(500),
    bcc: z.array(mailboxAddressSchema).max(500),
    subject: z.string().max(5_000),
    snippet: z.string().max(1_000),
    plainText: z.string().max(2_000_000).optional(),
    headers: z
      .array(
        z
          .object({ name: z.string().max(200), value: z.string().max(10_000) })
          .strict(),
      )
      .max(500),
    remoteLabelIds: z.array(z.string().max(1_000)).max(100),
    sentAt: z.number().optional(),
    receivedAt: z.number(),
    hasAttachments: z.boolean(),
    inInbox: z.boolean(),
    isRead: z.boolean(),
    direction: z.enum(["incoming", "outgoing"]),
    attachments: z.array(attachmentSchema).max(500),
  })
  .strict();

const folderSchema = z
  .object({
    remoteFolderId: z.string().min(1).max(1_000),
    name: z.string().max(500),
    kind: z.enum([
      "inbox",
      "sent",
      "drafts",
      "archive",
      "trash",
      "junk",
      "custom",
    ]),
  })
  .strict();

export const setupTokenPayloadSchema = z
  .object({
    version: z.literal(1),
    challengeId: z.string().min(32).max(200),
    ownerId: z.string().min(1).max(500),
    returnPath: z.string().startsWith("/").max(2_000),
    expiresAt: z.number().int(),
  })
  .strict();

export const completeConnectionRequestSchema = z
  .object({
    setupToken: z.string().min(40).max(8_000),
    bridgeAccountId: z.string().uuid(),
    address: z.string().email().max(320),
    displayName: z.string().max(300).optional(),
  })
  .strict();

export const claimJobsRequestSchema = z
  .object({
    bridgeAccountId: z.string().uuid(),
    maxJobs: z.number().int().min(1).max(10).default(5),
  })
  .strict();

const sendJobSchema = z
  .object({
    kind: z.literal("send"),
    jobId: z.string(),
    leaseId: z.string(),
    outboxId: z.string(),
    from: z.string().email(),
    to: z.array(mailboxAddressSchema),
    cc: z.array(mailboxAddressSchema),
    bcc: z.array(mailboxAddressSchema),
    subject: z.string(),
    plainText: z.string(),
    replyToInternetMessageId: z.string().optional(),
  })
  .strict();

const syncJobSchema = z
  .object({
    kind: z.literal("sync"),
    jobId: z.string(),
    leaseId: z.string(),
    cursor: z.string().optional(),
    reason: z.enum(["initial", "incremental", "manual", "reconcile"]),
  })
  .strict();

export const bridgeJobSchema = z.discriminatedUnion("kind", [
  sendJobSchema,
  syncJobSchema,
]);

export const claimJobsResponseSchema = z
  .object({ jobs: z.array(bridgeJobSchema) })
  .strict();

export const syncBatchRequestSchema = z
  .object({
    bridgeAccountId: z.string().uuid(),
    jobId: z.string(),
    leaseId: z.string(),
    cursor: z.string().max(100_000).optional(),
    folders: z.array(folderSchema).max(500).default([]),
    messages: z.array(normalizedICloudMessageSchema).max(50).default([]),
    deletedRemoteMessageIds: z
      .array(z.string().max(1_000))
      .max(2_000)
      .default([]),
    complete: z.boolean(),
    error: z.string().max(500).optional(),
  })
  .strict();

export const sendAcknowledgementSchema = z
  .object({
    bridgeAccountId: z.string().uuid(),
    jobId: z.string(),
    leaseId: z.string(),
    remoteMessageId: z.string().max(1_000).optional(),
    error: z.string().max(500).optional(),
    deliveryUnknown: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.remoteMessageId) !== Boolean(value.error), {
    message: "Exactly one of remoteMessageId or error is required",
  });

export type BridgeJob = z.infer<typeof bridgeJobSchema>;
export type NormalizedICloudMessage = z.infer<
  typeof normalizedICloudMessageSchema
>;
export type SetupTokenPayload = z.infer<typeof setupTokenPayloadSchema>;
