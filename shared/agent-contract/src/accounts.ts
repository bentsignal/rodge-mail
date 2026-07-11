import { z } from "zod";

import {
  convexIdSchema,
  mailProviderSchema,
  timestampSchema,
  untrustedContentMarkerSchema,
} from "./common.ts";

export const mailAccountStatusSchema = z.enum([
  "connected",
  "syncing",
  "error",
  "reauthorization_required",
  "disconnected",
]);

export const agentMailAccountSchema = z
  .object({
    id: convexIdSchema,
    provider: mailProviderSchema,
    address: z.string().min(1).max(320),
    displayName: z.string().max(500).optional(),
    status: mailAccountStatusSchema,
    lastSyncedAt: timestampSchema.optional(),
  })
  .strict();

export const listAccountsInputSchema = z.object({}).strict();

export const listAccountsOutputSchema = z
  .object({
    content: untrustedContentMarkerSchema,
    accounts: z.array(agentMailAccountSchema).max(50),
  })
  .strict();

export type AgentMailAccount = z.infer<typeof agentMailAccountSchema>;
export type ListAccountsInput = z.infer<typeof listAccountsInputSchema>;
export type ListAccountsOutput = z.infer<typeof listAccountsOutputSchema>;
