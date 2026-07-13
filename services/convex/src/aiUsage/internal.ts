import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { aiUsageAggregate } from "./aggregate";
import {
  AI_DAILY_LIMIT_USD,
  canReserveDailyUsage,
  utcDayBounds,
} from "./pricing";
import { vAiUsageKind } from "./validators";

export const reserve = internalMutation({
  args: {
    ownerId: v.string(),
    requestKey: v.string(),
    kind: vAiUsageKind,
    model: v.string(),
    reservedCostUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiUsage")
      .withIndex("by_request_key", (q) => q.eq("requestKey", args.requestKey))
      .unique();
    if (existing) {
      if (existing.ownerId !== args.ownerId) {
        throw new Error("AI usage request key collision");
      }
      return {
        allowed: existing.status !== "released",
        limitUsd: AI_DAILY_LIMIT_USD,
        resetAt: utcDayBounds(Date.now()).end,
      };
    }

    if (!canReserveDailyUsage(0, args.reservedCostUsd)) {
      return {
        allowed: false,
        limitUsd: AI_DAILY_LIMIT_USD,
        resetAt: utcDayBounds(Date.now()).end,
      };
    }

    const now = Date.now();
    const { start, end } = utcDayBounds(now);
    const spentUsd = await aiUsageAggregate.sum(ctx, {
      namespace: args.ownerId,
      bounds: {
        lower: { key: start, inclusive: true },
        upper: { key: end, inclusive: false },
      },
    });
    if (!canReserveDailyUsage(spentUsd, args.reservedCostUsd)) {
      return { allowed: false, limitUsd: AI_DAILY_LIMIT_USD, resetAt: end };
    }

    const usageId = await ctx.db.insert("aiUsage", {
      ownerId: args.ownerId,
      requestKey: args.requestKey,
      kind: args.kind,
      model: args.model,
      status: "reserved",
      costUsd: args.reservedCostUsd,
      reservedCostUsd: args.reservedCostUsd,
      createdAt: now,
      updatedAt: now,
    });
    const usage = await ctx.db.get(usageId);
    if (!usage) throw new Error("AI usage reservation disappeared");
    await aiUsageAggregate.insert(ctx, usage);
    return {
      allowed: true,
      limitUsd: AI_DAILY_LIMIT_USD,
      resetAt: end,
    };
  },
});

export const complete = internalMutation({
  args: {
    requestKey: v.string(),
    costUsd: v.number(),
    inputTokens: v.optional(v.number()),
    cachedInputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const usage = await findUsage(ctx, args.requestKey);
    if (usage?.status !== "reserved") return false;
    const now = Date.now();
    const updated = {
      ...usage,
      status: "complete" as const,
      costUsd: Math.max(0, Math.min(usage.reservedCostUsd, args.costUsd)),
      inputTokens: args.inputTokens,
      cachedInputTokens: args.cachedInputTokens,
      outputTokens: args.outputTokens,
      completedAt: now,
      updatedAt: now,
    };
    await ctx.db.patch(usage._id, updated);
    await aiUsageAggregate.replace(ctx, usage, updated);
    return true;
  },
});

export const release = internalMutation({
  args: { requestKey: v.string() },
  handler: async (ctx, args) => {
    const usage = await findUsage(ctx, args.requestKey);
    if (usage?.status !== "reserved") return false;
    const now = Date.now();
    const updated = {
      ...usage,
      status: "released" as const,
      costUsd: 0,
      completedAt: now,
      updatedAt: now,
    };
    await ctx.db.patch(usage._id, updated);
    await aiUsageAggregate.replace(ctx, usage, updated);
    return true;
  },
});

async function findUsage(ctx: MutationCtx, requestKey: string) {
  return await ctx.db
    .query("aiUsage")
    .withIndex("by_request_key", (q) => q.eq("requestKey", requestKey))
    .unique();
}
