import { z } from "zod";

import {
  convexIdSchema,
  mailboxAddressSchema,
  timestampSchema,
  untrustedContentMarkerSchema,
} from "./common";

export const MAX_AGENT_THREAD_MESSAGES = 100;
export const MAX_AGENT_MESSAGE_BODY_LENGTH = 50_000;
export const MAX_AGENT_MESSAGE_ATTACHMENTS = 50;
export const MAX_AGENT_THREAD_BODY_LENGTH = 200_000;
export const MAX_AGENT_THREAD_ATTACHMENTS = 200;

export const getThreadInputSchema = z
  .object({ threadId: convexIdSchema })
  .strict();

export const agentAttachmentSchema = z
  .object({
    fileName: z.string().max(1_024),
    contentType: z.string().max(255),
    size: z.number().int().nonnegative(),
    status: z.enum(["remote", "available", "error"]),
  })
  .strict();

export const agentThreadMessageSchema = z
  .object({
    id: convexIdSchema,
    direction: z.enum(["incoming", "outgoing"]),
    from: mailboxAddressSchema,
    replyTo: z.array(mailboxAddressSchema).max(100).optional(),
    to: z.array(mailboxAddressSchema).max(100),
    cc: z.array(mailboxAddressSchema).max(100),
    bcc: z.array(mailboxAddressSchema).max(100),
    subject: z.string().max(2_000),
    sentAt: timestampSchema.optional(),
    receivedAt: timestampSchema,
    bodyState: z.enum(["available", "remote", "truncated"]),
    plainText: z.string().max(MAX_AGENT_MESSAGE_BODY_LENGTH).optional(),
    contentTruncated: z.boolean(),
    hasAttachments: z.boolean(),
    attachments: z
      .array(agentAttachmentSchema)
      .max(MAX_AGENT_MESSAGE_ATTACHMENTS),
    attachmentsTruncated: z.boolean(),
  })
  .strict();

export const agentThreadSchema = z
  .object({
    id: convexIdSchema,
    accountId: convexIdSchema,
    accountAddress: z.string().min(1).max(320),
    subject: z.string().max(2_000),
    participants: z.array(mailboxAddressSchema).max(200),
    latestMessageAt: timestampSchema,
    messages: z.array(agentThreadMessageSchema).max(MAX_AGENT_THREAD_MESSAGES),
    messagesTruncated: z.boolean(),
  })
  .strict()
  .superRefine((thread, context) => {
    const bodyLength = thread.messages.reduce(
      (total, message) => total + (message.plainText?.length ?? 0),
      0,
    );
    if (bodyLength > MAX_AGENT_THREAD_BODY_LENGTH) {
      context.addIssue({
        code: "custom",
        message: "Thread body exceeds the agent output limit",
        path: ["messages"],
      });
    }
    const attachmentCount = thread.messages.reduce(
      (total, message) => total + message.attachments.length,
      0,
    );
    if (attachmentCount > MAX_AGENT_THREAD_ATTACHMENTS) {
      context.addIssue({
        code: "custom",
        message: "Thread attachments exceed the agent output limit",
        path: ["messages"],
      });
    }
  });

export const getThreadOutputSchema = z
  .object({
    content: untrustedContentMarkerSchema,
    thread: agentThreadSchema,
  })
  .strict();

export type AgentAttachment = z.infer<typeof agentAttachmentSchema>;
export type AgentThread = z.infer<typeof agentThreadSchema>;
export type AgentThreadMessage = z.infer<typeof agentThreadMessageSchema>;
export type GetThreadInput = z.infer<typeof getThreadInputSchema>;
export type GetThreadOutput = z.infer<typeof getThreadOutputSchema>;
