import { ConvexError, v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { vSyncReason } from "../mail/validators";

export const createRun = internalMutation({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    reason: vSyncReason,
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== args.ownerId) {
      throw new ConvexError("Mail account not found");
    }
    const now = Date.now();
    return await ctx.db.insert("syncRuns", {
      ownerId: args.ownerId,
      accountId: args.accountId,
      reason: args.reason,
      status: "pending",
      cursor: args.cursor,
      attempt: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const startRun = internalMutation({
  args: { syncRunId: v.id("syncRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.syncRunId);
    if (!run) throw new ConvexError("Sync run not found");
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(run._id, {
        attempt: run.attempt + 1,
        error: undefined,
        startedAt: now,
        status: "running",
        updatedAt: now,
      }),
      ctx.db.patch(run.accountId, {
        lastSyncError: undefined,
        status: "syncing",
        updatedAt: now,
      }),
    ]);
  },
});

export const finishRun = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    cursor: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.syncRunId);
    if (!run) throw new ConvexError("Sync run not found");
    const now = Date.now();
    const failed = args.error !== undefined;
    await Promise.all([
      ctx.db.patch(run._id, {
        completedAt: now,
        cursor: args.cursor ?? run.cursor,
        error: args.error,
        status: failed ? "failed" : "succeeded",
        updatedAt: now,
      }),
      ctx.db.patch(run.accountId, {
        lastSyncError: args.error,
        lastSyncedAt: failed ? undefined : now,
        status: failed ? "error" : "connected",
        updatedAt: now,
      }),
    ]);
  },
});
