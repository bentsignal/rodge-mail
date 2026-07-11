import { z } from "zod";

import { convexIdSchema } from "./common";

export const agentScopeSchema = z.enum([
  "accounts:read",
  "mail:search",
  "threads:read",
]);

export const agentAccountAccessSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }).strict(),
  z
    .object({
      mode: z.literal("allowlist"),
      accountIds: z
        .array(convexIdSchema)
        .min(1)
        .max(50)
        .refine(allUnique, "Account IDs must be unique"),
    })
    .strict(),
]);

export const agentCredentialGrantSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    scopes: z
      .array(agentScopeSchema)
      .min(1)
      .max(3)
      .refine(allUnique, "Scopes must be unique"),
    accountAccess: agentAccountAccessSchema,
    expiresInDays: z.number().int().min(1).max(90),
  })
  .strict();

export type AgentAccountAccess = z.infer<typeof agentAccountAccessSchema>;
export type AgentCredentialGrant = z.infer<typeof agentCredentialGrantSchema>;
export type AgentScope = z.infer<typeof agentScopeSchema>;

function allUnique(values: readonly string[]) {
  return new Set(values).size === values.length;
}
