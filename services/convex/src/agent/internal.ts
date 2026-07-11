import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";
import {
  vAgentAccountAccess,
  vAgentAuditOutcome,
  vAgentScope,
  vAgentToolName,
} from "./validators";

const CLEANUP_AGENT_AUDITS = makeFunctionReference<
  "mutation",
  { limit?: number },
  unknown
>("agent/internal:cleanupExpiredAudits");
const CLEANUP_AGENT_CREDENTIALS = makeFunctionReference<
  "mutation",
  { limit?: number },
  unknown
>("agent/internal:cleanupExpiredCredentials");

export const storeCredential = internalMutation({
  args: {
    ownerId: v.string(),
    label: v.string(),
    tokenHash: v.string(),
    scopes: v.array(vAgentScope),
    accountAccess: vAgentAccountAccess,
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.accountAccess.mode === "allowlist") {
      for (const accountId of args.accountAccess.accountIds) {
        const account = await ctx.db.get(accountId);
        if (!account || account.ownerId !== args.ownerId) {
          throw new Error("Mail account not found");
        }
      }
    }
    const duplicate = await ctx.db
      .query("agentCredentials")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (duplicate) throw new Error("Credential token collision");
    const activeCredentials = await ctx.db
      .query("agentCredentials")
      .withIndex("by_owner_revoked_expires", (q) =>
        q
          .eq("ownerId", args.ownerId)
          .eq("revokedAt", undefined)
          .gt("expiresAt", Date.now()),
      )
      .take(50);
    if (activeCredentials.length >= 50) {
      throw new Error("Active credential limit reached");
    }
    const now = Date.now();
    const credentialId = await ctx.db.insert("agentCredentials", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return { credentialId, createdAt: now, expiresAt: args.expiresAt };
  },
});

export const findCredentialByHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query("agentCredentials")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    return credential;
  },
});

export const recordAudit = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const auditId = await ctx.db.insert("agentAuditEvents", args);
    if (args.credentialId) {
      const credential = await ctx.db.get(args.credentialId);
      if (credential) {
        await ctx.db.patch(credential._id, {
          lastUsedAt: args.createdAt,
          updatedAt: args.createdAt,
        });
      }
    }
    return auditId;
  },
});

export const cleanupExpiredAudits = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1_000;
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 100)));
    const expired = await ctx.db
      .query("agentAuditEvents")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
      .take(limit);
    await Promise.all(
      expired.map(async (event) => await ctx.db.delete(event._id)),
    );
    if (expired.length === limit) {
      await ctx.scheduler.runAfter(0, CLEANUP_AGENT_AUDITS, { limit });
    }
    return { deleted: expired.length, hasMore: expired.length === limit };
  },
});

export const cleanupExpiredCredentials = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1_000;
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 100)));
    const expired = await ctx.db
      .query("agentCredentials")
      .withIndex("by_expires", (q) => q.lt("expiresAt", cutoff))
      .take(limit);
    await Promise.all(
      expired.map(async (credential) => await ctx.db.delete(credential._id)),
    );
    if (expired.length === limit) {
      await ctx.scheduler.runAfter(0, CLEANUP_AGENT_CREDENTIALS, { limit });
    }
    return { deleted: expired.length, hasMore: expired.length === limit };
  },
});
