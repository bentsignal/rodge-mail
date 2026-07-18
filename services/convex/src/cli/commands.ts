import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type {
  GetThreadOutput,
  ListAccountsOutput,
  SearchMailOutput,
} from "@rodge-mail/agent-contract";
import { MAX_AGENT_SEARCH_RESULTS } from "@rodge-mail/agent-contract";

import type { Id } from "../_generated/dataModel";
import { authedAction } from "../utils";

interface OwnerArgs extends Record<string, unknown> {
  accountAccess: { mode: "all" };
  ownerId: string;
}

interface SearchArgs extends OwnerArgs {
  accountId?: string;
  cursor?: string;
  limit: number;
  query: string;
}

const LIST_ACCOUNTS = makeFunctionReference<
  "query",
  OwnerArgs,
  ListAccountsOutput
>("agent/queries:listAccounts");
const GET_THREAD = makeFunctionReference<
  "query",
  OwnerArgs & { threadId: string },
  GetThreadOutput | null
>("agent/queries:getThread");
const SEARCH_MAIL = makeFunctionReference<
  "action",
  SearchArgs,
  SearchMailOutput | null
>("agent/search:searchMail");

export const listAccounts = authedAction({
  args: {},
  handler: async (ctx) =>
    await ctx.runQuery(LIST_ACCOUNTS, ownerArguments(ctx.ownerId)),
});

export const listMail = authedAction({
  args: {
    accountId: v.optional(v.id("mailAccounts")),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    await search(ctx, {
      accountId: args.accountId,
      cursor: args.cursor,
      limit: boundedLimit(args.limit),
      query: "",
    }),
});

export const searchMail = authedAction({
  args: {
    accountId: v.optional(v.id("mailAccounts")),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    query: v.string(),
  },
  handler: async (ctx, args) =>
    await search(ctx, {
      accountId: args.accountId,
      cursor: args.cursor,
      limit: boundedLimit(args.limit),
      query: args.query.trim(),
    }),
});

export const getThread = authedAction({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) =>
    await ctx.runQuery(GET_THREAD, {
      ...ownerArguments(ctx.ownerId),
      threadId: args.threadId,
    }),
});

function ownerArguments(ownerId: string) {
  return { accountAccess: { mode: "all" as const }, ownerId };
}

function boundedLimit(limit: number | undefined) {
  if (!Number.isInteger(limit)) return 16;
  return Math.max(1, Math.min(MAX_AGENT_SEARCH_RESULTS, limit ?? 16));
}

async function search(
  ctx: {
    ownerId: string;
    runAction: (
      reference: typeof SEARCH_MAIL,
      args: SearchArgs,
    ) => Promise<SearchMailOutput | null>;
  },
  args: {
    accountId?: Id<"mailAccounts">;
    cursor?: string;
    limit: number;
    query: string;
  },
) {
  return await ctx.runAction(SEARCH_MAIL, {
    ...ownerArguments(ctx.ownerId),
    ...args,
  });
}
