import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { stableHash } from "../classification/normalize";
import { createEmbedding, isAiConfigured } from "../classification/openai";
import { rateLimiter } from "../limiter";
import { authedAction } from "../utils";

interface ScopeArgs extends Record<string, unknown> {
  ownerId: string;
  accountId?: Id<"mailAccounts">;
}

interface ScoredEmbedding {
  embeddingId: Id<"messageEmbeddings">;
  score: number;
}

interface HydrateArgs extends ScopeArgs {
  matches: ScoredEmbedding[];
}

interface SearchResult {
  messageId: Id<"messages">;
  score: number;
}

const VALIDATE_SCOPE = makeFunctionReference<"query", ScopeArgs, boolean>(
  "embedding/queries:validateScope",
);
const HYDRATE_RESULTS = makeFunctionReference<
  "query",
  HydrateArgs,
  SearchResult[]
>("embedding/queries:hydrateResults");

export const semanticSearch = authedAction({
  args: {
    searchTerm: v.string(),
    accountId: v.optional(v.id("mailAccounts")),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      messageId: v.id("messages"),
      score: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const searchTerm = args.searchTerm.trim().slice(0, 500);
    if (!searchTerm) return [];
    const ownsScope = await ctx.runQuery(VALIDATE_SCOPE, {
      ownerId: ctx.ownerId,
      accountId: args.accountId,
    });
    if (!ownsScope) throw new ConvexError("Mail account not found");

    const limited = await rateLimiter.limit(ctx, "semanticSearch", {
      key: ctx.ownerId,
    });
    if (!limited.ok)
      throw new ConvexError("Semantic search rate limit exceeded");
    if (!isAiConfigured())
      throw new ConvexError("Semantic search is not configured");

    const vector = await createEmbedding(
      searchTerm,
      `search:${ctx.ownerId}:${stableHash(searchTerm)}`,
    );
    const matches = await ctx.vectorSearch(
      "messageEmbeddings",
      "search_vector",
      {
        vector,
        limit: Math.max(1, Math.min(50, Math.floor(args.limit ?? 16))),
        filter: (q) => q.eq("ownerId", ctx.ownerId),
      },
    );
    return await ctx.runQuery(HYDRATE_RESULTS, {
      ownerId: ctx.ownerId,
      accountId: args.accountId,
      matches: matches.map((match) => ({
        embeddingId: match._id,
        score: match._score,
      })),
    });
  },
});
