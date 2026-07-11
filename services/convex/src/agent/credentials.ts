/* eslint-disable complexity -- Credential issuance validates each independent least-privilege constraint before storing a secret hash. */
import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { rateLimiter } from "../limiter";
import { authedAction, authedMutation, authedQuery } from "../utils";
import { allUnique, validateCredentialLifetime } from "./policy";
import { createAgentToken, hashAgentToken } from "./token";
import { vAgentAccountAccess, vAgentScope } from "./validators";

interface CreateCredentialArgs extends Record<string, unknown> {
  accountAccess:
    | { mode: "all" }
    | { mode: "allowlist"; accountIds: Id<"mailAccounts">[] };
  expiresAt: number;
  label: string;
  ownerId: string;
  scopes: ("accounts:read" | "mail:search" | "threads:read")[];
  tokenHash: string;
}

interface CreatedCredential {
  credentialId: Id<"agentCredentials">;
  createdAt: number;
  expiresAt: number;
}

const STORE_CREDENTIAL = makeFunctionReference<
  "mutation",
  CreateCredentialArgs,
  CreatedCredential
>("agent/internal:storeCredential");

export const create = authedAction({
  args: {
    label: v.string(),
    scopes: v.array(vAgentScope),
    accountAccess: vAgentAccountAccess,
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limited = await rateLimiter.limit(ctx, "agentCredentialCreate", {
      key: ctx.ownerId,
    });
    if (!limited.ok)
      throw new ConvexError("Credential creation rate limit exceeded");
    const label = args.label.trim();
    if (label.length < 1 || label.length > 80) {
      throw new ConvexError(
        "Credential label must be between 1 and 80 characters",
      );
    }
    if (
      args.scopes.length < 1 ||
      args.scopes.length > 3 ||
      !allUnique(args.scopes)
    ) {
      throw new ConvexError("Credential scopes are invalid");
    }
    if (
      args.accountAccess.mode === "allowlist" &&
      (args.accountAccess.accountIds.length < 1 ||
        args.accountAccess.accountIds.length > 50 ||
        !allUnique(args.accountAccess.accountIds))
    ) {
      throw new ConvexError("Credential account access is invalid");
    }
    let days;
    try {
      days = validateCredentialLifetime(args.expiresInDays);
    } catch {
      throw new ConvexError(
        "Credential lifetime must be between 1 and 90 days",
      );
    }
    const token = createAgentToken();
    const tokenHash = await hashAgentToken(token);
    const expiresAt = Date.now() + days * 24 * 60 * 60 * 1_000;
    const created = await ctx.runMutation(STORE_CREDENTIAL, {
      ownerId: ctx.ownerId,
      label,
      scopes: args.scopes,
      accountAccess: args.accountAccess,
      expiresAt,
      tokenHash,
    });
    return { ...created, label, token };
  },
});

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [active, recent] = await Promise.all([
      ctx.db
        .query("agentCredentials")
        .withIndex("by_owner_revoked_expires", (q) =>
          q
            .eq("ownerId", ctx.ownerId)
            .eq("revokedAt", undefined)
            .gt("expiresAt", now),
        )
        .take(50),
      ctx.db
        .query("agentCredentials")
        .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
        .order("desc")
        .take(50),
    ]);
    const credentials = [
      ...active,
      ...recent.filter(
        (credential) =>
          !active.some((candidate) => candidate._id === credential._id),
      ),
    ].slice(0, 50);
    return credentials.map((credential) => ({
      _id: credential._id,
      label: credential.label,
      scopes: credential.scopes,
      accountAccess: credential.accountAccess,
      expiresAt: credential.expiresAt,
      revokedAt: credential.revokedAt,
      lastUsedAt: credential.lastUsedAt,
      createdAt: credential.createdAt,
    }));
  },
});

export const revoke = authedMutation({
  args: { credentialId: v.id("agentCredentials") },
  handler: async (ctx, args) => {
    const credential = await ctx.db.get(args.credentialId);
    if (!credential || credential.ownerId !== ctx.ownerId) {
      throw new ConvexError("Agent credential not found");
    }
    if (credential.revokedAt !== undefined) return false;
    const now = Date.now();
    await ctx.db.patch(credential._id, { revokedAt: now, updatedAt: now });
    return true;
  },
});
