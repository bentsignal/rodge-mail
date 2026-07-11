import { v } from "convex/values";

export const vAgentScope = v.union(
  v.literal("accounts:read"),
  v.literal("mail:search"),
  v.literal("threads:read"),
);

export const vAgentAccountAccess = v.union(
  v.object({ mode: v.literal("all") }),
  v.object({
    mode: v.literal("allowlist"),
    accountIds: v.array(v.id("mailAccounts")),
  }),
);

export const vAgentCredential = v.object({
  ownerId: v.string(),
  label: v.string(),
  tokenHash: v.string(),
  scopes: v.array(vAgentScope),
  accountAccess: vAgentAccountAccess,
  expiresAt: v.number(),
  revokedAt: v.optional(v.number()),
  lastUsedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const vAgentToolName = v.union(
  v.literal("list_accounts"),
  v.literal("search_mail"),
  v.literal("get_thread"),
);

export const vAgentAuditOutcome = v.union(
  v.literal("succeeded"),
  v.literal("denied"),
  v.literal("error"),
);

export const vAgentAuditEvent = v.object({
  ownerId: v.optional(v.string()),
  credentialId: v.optional(v.id("agentCredentials")),
  credentialFingerprint: v.string(),
  tool: v.optional(vAgentToolName),
  requestId: v.string(),
  argsHash: v.string(),
  outcome: vAgentAuditOutcome,
  resultCount: v.optional(v.number()),
  durationMs: v.number(),
  errorCode: v.optional(v.string()),
  createdAt: v.number(),
});
