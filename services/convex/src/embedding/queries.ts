import { v } from "convex/values";

import { internalQuery } from "../_generated/server";

const vScoredEmbedding = v.object({
  embeddingId: v.id("messageEmbeddings"),
  score: v.number(),
});

export const validateScope = internalQuery({
  args: {
    ownerId: v.string(),
    accountId: v.optional(v.id("mailAccounts")),
  },
  handler: async (ctx, args) => {
    if (!args.accountId) return true;
    const account = await ctx.db.get(args.accountId);
    return account?.ownerId === args.ownerId;
  },
});

export const hydrateResults = internalQuery({
  args: {
    ownerId: v.string(),
    accountId: v.optional(v.id("mailAccounts")),
    matches: v.array(vScoredEmbedding),
  },
  returns: v.array(
    v.object({
      messageId: v.id("messages"),
      score: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const results = [];
    for (const match of args.matches) {
      const embedding = await ctx.db.get(match.embeddingId);
      if (!embedding || embedding.ownerId !== args.ownerId) continue;
      if (args.accountId && embedding.accountId !== args.accountId) continue;
      const message = await ctx.db.get(embedding.messageId);
      if (!message || message.ownerId !== args.ownerId || !message.inInbox)
        continue;
      results.push({
        score: match.score,
        messageId: message._id,
      });
    }
    return results;
  },
});
