import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { SearchMailOutput } from "@rodge-mail/agent-contract";
import { MAX_AGENT_SEARCH_RESULTS } from "@rodge-mail/agent-contract";

import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { stableHash } from "../classification/normalize";
import { createEmbedding, isAiConfigured } from "../classification/openai";
import { rateLimiter } from "../limiter";
import { vAgentAccountAccess } from "./validators";

interface LexicalArgs extends Record<string, unknown> {
  ownerId: string;
  accountAccess:
    | { mode: "all" }
    | { mode: "allowlist"; accountIds: Id<"mailAccounts">[] };
  accountId?: string;
  searchTerm: string;
  paginationOpts: { cursor: string | null; numItems: number };
}

interface LexicalResult extends SearchMailOutput {
  allowedAccountIds: Id<"mailAccounts">[];
  selectedAccountId?: Id<"mailAccounts">;
  searchPlan: {
    after?: number;
    before?: number;
    lexicalQuery: string;
    sender?: string;
    subject?: string;
  };
}

interface ResolveEmbeddingArgs extends Record<string, unknown> {
  ownerId: string;
  allowedAccountIds: Id<"mailAccounts">[];
  matches: { embeddingId: Id<"messageEmbeddings">; score: number }[];
}

interface HydrateArgs extends Record<string, unknown> {
  ownerId: string;
  allowedAccountIds: Id<"mailAccounts">[];
  messageScores: { messageId: Id<"messages">; score: number }[];
  after?: number;
  before?: number;
  sender?: string;
  subject?: string;
}

type SemanticHits = SearchMailOutput["messages"];

const LEXICAL_SEARCH = makeFunctionReference<
  "query",
  LexicalArgs,
  LexicalResult | null
>("agent/queries:lexicalSearch");
const RESOLVE_EMBEDDINGS = makeFunctionReference<
  "query",
  ResolveEmbeddingArgs,
  { messageId: Id<"messages">; score: number }[]
>("agent/queries:resolveSemanticEmbeddings");
const HYDRATE_SEMANTIC = makeFunctionReference<
  "query",
  HydrateArgs,
  SemanticHits
>("agent/queries:hydrateSemantic");

export const searchMail = internalAction({
  args: {
    credentialId: v.id("agentCredentials"),
    ownerId: v.string(),
    accountAccess: vAgentAccountAccess,
    accountId: v.optional(v.string()),
    query: v.string(),
    limit: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lexical = await ctx.runQuery(LEXICAL_SEARCH, {
      ownerId: args.ownerId,
      accountAccess: args.accountAccess,
      accountId: args.accountId,
      searchTerm: args.query,
      paginationOpts: { cursor: args.cursor ?? null, numItems: args.limit },
    });
    if (!lexical) return null;
    if (args.cursor || !lexical.searchPlan.lexicalQuery || !isAiConfigured()) {
      return publicSearchResult(lexical, "unavailable");
    }
    try {
      const limited = await rateLimiter.limit(ctx, "agentSemanticSearch", {
        key: `${args.ownerId}:${args.credentialId}`,
      });
      if (!limited.ok) return publicSearchResult(lexical, "unavailable");
      const vector = await createEmbedding(
        lexical.searchPlan.lexicalQuery,
        `agent-search:${args.ownerId}:${stableHash(
          lexical.searchPlan.lexicalQuery,
        )}`,
      );
      const matches = await scopedVectorSearch(ctx, {
        accountId: lexical.selectedAccountId,
        allowedAccountIds: lexical.allowedAccountIds,
        ownerId: args.ownerId,
        vector,
      });
      const messageScores = await ctx.runQuery(RESOLVE_EMBEDDINGS, {
        ownerId: args.ownerId,
        allowedAccountIds: lexical.allowedAccountIds,
        matches: matches.map((match) => ({
          embeddingId: match._id,
          score: match._score,
        })),
      });
      const semantic = await ctx.runQuery(HYDRATE_SEMANTIC, {
        ownerId: args.ownerId,
        allowedAccountIds: lexical.allowedAccountIds,
        messageScores,
        after: lexical.searchPlan.after,
        before: lexical.searchPlan.before,
        sender: lexical.searchPlan.sender,
        subject: lexical.searchPlan.subject,
      });
      return {
        ...publicSearchResult(lexical, "applied"),
        messages: mergeSearchHits(lexical.messages, semantic, args.limit),
      };
    } catch {
      return publicSearchResult(lexical, "unavailable");
    }
  },
});

function publicSearchResult(
  lexical: LexicalResult,
  semanticSearch: "applied" | "unavailable",
) {
  return {
    content: lexical.content,
    messages: lexical.messages.slice(0, MAX_AGENT_SEARCH_RESULTS),
    nextCursor: lexical.nextCursor,
    semanticSearch,
  } satisfies SearchMailOutput;
}

async function scopedVectorSearch(
  ctx: ActionCtx,
  args: {
    accountId?: Id<"mailAccounts">;
    allowedAccountIds: Id<"mailAccounts">[];
    ownerId: string;
    vector: number[];
  },
) {
  const accountId = args.accountId;
  if (accountId) {
    return await ctx.vectorSearch("messageEmbeddings", "search_vector", {
      vector: args.vector,
      limit: 50,
      filter: (q) => q.eq("accountId", accountId),
    });
  }
  if (args.allowedAccountIds.length === 0) return [];
  const perAccountLimit = Math.min(
    50,
    Math.ceil(50 / args.allowedAccountIds.length) + 5,
  );
  const matches = await Promise.all(
    args.allowedAccountIds.map(async (accountId) => {
      return await ctx.vectorSearch("messageEmbeddings", "search_vector", {
        vector: args.vector,
        limit: perAccountLimit,
        filter: (q) => q.eq("accountId", accountId),
      });
    }),
  );
  return matches
    .flat()
    .sort((left, right) => right._score - left._score)
    .slice(0, 50);
}

export function mergeSearchHits(
  lexical: SearchMailOutput["messages"],
  semantic: SearchMailOutput["messages"],
  limit: number,
) {
  const boundedLimit = Math.max(1, Math.min(MAX_AGENT_SEARCH_RESULTS, limit));
  const semanticById = new Map(semantic.map((hit) => [hit.messageId, hit]));
  const merged = lexical.map((hit) => {
    const semanticHit = semanticById.get(hit.messageId);
    if (!semanticHit) return hit;
    semanticById.delete(hit.messageId);
    return { ...hit, matchKind: "both" as const, score: semanticHit.score };
  });
  for (const hit of semanticById.values()) {
    if (merged.length >= boundedLimit) break;
    merged.push(hit);
  }
  return merged.slice(0, boundedLimit);
}
