import { z } from "zod";

import {
  classificationCategorySchema,
  convexIdSchema,
  mailboxAddressSchema,
  timestampSchema,
  untrustedContentMarkerSchema,
} from "./common.ts";

export const MAX_AGENT_SEARCH_RESULTS = 25;
export const MAX_AGENT_SEARCH_QUERY_LENGTH = 500;

export const searchMailInputSchema = z
  .object({
    query: z.string().trim().min(2).max(MAX_AGENT_SEARCH_QUERY_LENGTH),
    accountId: convexIdSchema.optional(),
    limit: z.number().int().min(1).max(MAX_AGENT_SEARCH_RESULTS).optional(),
    cursor: z.string().min(1).max(4096).optional(),
  })
  .strict();

export const agentSearchHitSchema = z
  .object({
    messageId: convexIdSchema,
    threadId: convexIdSchema,
    accountId: convexIdSchema,
    accountAddress: z.string().min(1).max(320),
    direction: z.enum(["incoming", "outgoing"]),
    from: mailboxAddressSchema,
    to: z.array(mailboxAddressSchema).max(100),
    subject: z.string().max(2_000),
    snippet: z.string().max(2_000),
    receivedAt: timestampSchema,
    isRead: z.boolean(),
    isPinned: z.boolean(),
    hasAttachments: z.boolean(),
    importance: z.number().min(0).max(1).optional(),
    category: classificationCategorySchema.optional(),
    classificationSummary: z.string().max(280).optional(),
    matchKind: z.enum(["lexical", "semantic", "both"]),
    score: z.number().min(0).max(1).optional(),
  })
  .strict();

export const searchMailOutputSchema = z
  .object({
    content: untrustedContentMarkerSchema,
    messages: z.array(agentSearchHitSchema).max(MAX_AGENT_SEARCH_RESULTS),
    nextCursor: z.string().max(4096).optional(),
    semanticSearch: z.enum(["applied", "unavailable"]),
  })
  .strict();

export type AgentSearchHit = z.infer<typeof agentSearchHitSchema>;
export type SearchMailInput = z.infer<typeof searchMailInputSchema>;
export type SearchMailOutput = z.infer<typeof searchMailOutputSchema>;
