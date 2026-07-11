/* eslint-disable complexity, max-lines -- Read-only projections deliberately recheck every related owner/account row before serialization. */
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import {
  MAX_AGENT_MESSAGE_ATTACHMENTS,
  MAX_AGENT_THREAD_ATTACHMENTS,
  MAX_AGENT_THREAD_BODY_LENGTH,
  MAX_AGENT_THREAD_MESSAGES,
} from "@rodge-mail/agent-contract";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { internalQuery } from "../_generated/server";
import { matchesMailSearch, parseMailSearch } from "../mail/search";
import { filterAllowedAccountIds } from "./policy";
import {
  projectAccount,
  projectSearchHit,
  projectThreadMessage,
  untrustedMailContent,
} from "./projections";
import { vAgentAccountAccess } from "./validators";

export const listAccounts = internalQuery({
  args: { ownerId: v.string(), accountAccess: vAgentAccountAccess },
  handler: async (ctx, args) => {
    const accounts = await ownedAllowedAccounts(
      ctx,
      args.ownerId,
      args.accountAccess,
    );
    return {
      content: untrustedMailContent,
      accounts: accounts.slice(0, 50).map(projectAccount),
    };
  },
});

export const getThread = internalQuery({
  args: {
    ownerId: v.string(),
    accountAccess: vAgentAccountAccess,
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const threadId = ctx.db.normalizeId("threads", args.threadId);
    if (!threadId) return null;
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.ownerId !== args.ownerId) return null;
    const accounts = await ownedAllowedAccounts(
      ctx,
      args.ownerId,
      args.accountAccess,
    );
    const account = accounts.find(
      (candidate) => candidate._id === thread.accountId,
    );
    if (!account) return null;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
      .order("asc")
      .filter((q) =>
        q.and(
          q.eq(q.field("ownerId"), args.ownerId),
          q.eq(q.field("accountId"), account._id),
        ),
      )
      .take(MAX_AGENT_THREAD_MESSAGES + 1);
    let bodyBudget = MAX_AGENT_THREAD_BODY_LENGTH;
    let attachmentBudget = MAX_AGENT_THREAD_ATTACHMENTS;
    const projectedMessages = [];
    for (const message of messages.slice(0, MAX_AGENT_THREAD_MESSAGES)) {
      const [content, attachments] = await Promise.all([
        ctx.db
          .query("messageContents")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .filter((q) => q.eq(q.field("ownerId"), args.ownerId))
          .first(),
        ctx.db
          .query("attachments")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .filter((q) => q.eq(q.field("ownerId"), args.ownerId))
          .take(
            Math.max(
              1,
              Math.min(MAX_AGENT_MESSAGE_ATTACHMENTS, attachmentBudget) + 1,
            ),
          ),
      ]);
      const projected = projectThreadMessage({
        attachments,
        attachmentBudget,
        bodyBudget,
        content,
        message,
      });
      projectedMessages.push(projected.message);
      bodyBudget -= projected.bodyBytes;
      attachmentBudget -= projected.attachmentCount;
    }
    return {
      content: untrustedMailContent,
      thread: {
        id: thread._id,
        accountId: account._id,
        accountAddress: account.address.slice(0, 320),
        subject: thread.subject.slice(0, 2_000),
        participants: thread.participants.slice(0, 200).map((participant) => ({
          address: participant.address.slice(0, 320),
          name: participant.name?.slice(0, 500),
        })),
        latestMessageAt: Math.max(0, Math.floor(thread.latestMessageAt)),
        messages: projectedMessages,
        messagesTruncated: messages.length > MAX_AGENT_THREAD_MESSAGES,
      },
    };
  },
});

export const lexicalSearch = internalQuery({
  args: {
    ownerId: v.string(),
    accountAccess: vAgentAccountAccess,
    accountId: v.optional(v.string()),
    searchTerm: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const accounts = await ownedAllowedAccounts(
      ctx,
      args.ownerId,
      args.accountAccess,
    );
    if (
      args.accountAccess.mode === "allowlist" &&
      accounts.length > 1 &&
      !args.accountId
    ) {
      return null;
    }
    const normalizedAccountId = args.accountId
      ? ctx.db.normalizeId("mailAccounts", args.accountId)
      : undefined;
    if (args.accountId && !normalizedAccountId) return null;
    const allowedIds = new Set(accounts.map((account) => account._id));
    if (normalizedAccountId && !allowedIds.has(normalizedAccountId))
      return null;
    const plan = parseMailSearch(args.searchTerm);
    const implicitAccountId =
      args.accountAccess.mode === "allowlist" && accounts.length === 1
        ? accounts[0]?._id
        : undefined;
    const selectedAccountId = normalizedAccountId ?? implicitAccountId;
    const results = await searchPage(ctx, {
      accountId: selectedAccountId,
      ownerId: args.ownerId,
      paginationOpts: args.paginationOpts,
      plan,
    });
    const accountById = new Map(
      accounts.map((account) => [account._id, account]),
    );
    const messages = [];
    for (const message of results.page) {
      const account = accountById.get(message.accountId);
      if (
        !account ||
        message.ownerId !== args.ownerId ||
        !message.inInbox ||
        message.hiddenAt !== undefined ||
        !matchesMailSearch(message, plan)
      ) {
        continue;
      }
      const classification = await ownedClassification(
        ctx,
        args.ownerId,
        message._id,
      );
      messages.push(
        projectSearchHit({
          account,
          classification,
          matchKind: "lexical",
          message,
        }),
      );
    }
    return {
      content: untrustedMailContent,
      messages,
      nextCursor: results.isDone ? undefined : results.continueCursor,
      semanticSearch: "unavailable" as const,
      allowedAccountIds: [...allowedIds],
      selectedAccountId,
      searchPlan: serializeSearchPlan(plan),
    };
  },
});

export function serializeSearchPlan(plan: ReturnType<typeof parseMailSearch>) {
  return {
    lexicalQuery: plan.lexicalQuery,
    ...(plan.after === undefined ? {} : { after: plan.after }),
    ...(plan.before === undefined ? {} : { before: plan.before }),
    ...(plan.sender === undefined ? {} : { sender: plan.sender }),
    ...(plan.subject === undefined ? {} : { subject: plan.subject }),
  };
}

export const hydrateSemantic = internalQuery({
  args: {
    ownerId: v.string(),
    allowedAccountIds: v.array(v.id("mailAccounts")),
    messageScores: v.array(
      v.object({ messageId: v.id("messages"), score: v.number() }),
    ),
    after: v.optional(v.number()),
    before: v.optional(v.number()),
    sender: v.optional(v.string()),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowed = new Set(args.allowedAccountIds);
    const accounts = await Promise.all(
      args.allowedAccountIds.map(
        async (accountId) => await ctx.db.get(accountId),
      ),
    );
    const accountById = new Map(
      accounts
        .filter(
          (account): account is Doc<"mailAccounts"> =>
            account?.ownerId === args.ownerId,
        )
        .map((account) => [account._id, account]),
    );
    const hits = [];
    for (const candidate of args.messageScores) {
      const message = await ctx.db.get(candidate.messageId);
      if (
        !message ||
        message.ownerId !== args.ownerId ||
        !allowed.has(message.accountId) ||
        !message.inInbox ||
        message.hiddenAt !== undefined ||
        !matchesMailSearch(message, args)
      ) {
        continue;
      }
      const account = accountById.get(message.accountId);
      const [thread, classification] = await Promise.all([
        ctx.db.get(message.threadId),
        ownedClassification(ctx, args.ownerId, message._id),
      ]);
      if (
        !account ||
        !thread ||
        thread.ownerId !== args.ownerId ||
        thread.accountId !== account._id
      ) {
        continue;
      }
      hits.push(
        projectSearchHit({
          account,
          classification,
          matchKind: "semantic",
          message,
          score: candidate.score,
        }),
      );
    }
    return hits;
  },
});

export const resolveSemanticEmbeddings = internalQuery({
  args: {
    ownerId: v.string(),
    allowedAccountIds: v.array(v.id("mailAccounts")),
    matches: v.array(
      v.object({ embeddingId: v.id("messageEmbeddings"), score: v.number() }),
    ),
  },
  handler: async (ctx, args) => {
    const allowed = new Set(args.allowedAccountIds);
    const messageScores = [];
    for (const match of args.matches) {
      const embedding = await ctx.db.get(match.embeddingId);
      if (
        !embedding ||
        embedding.ownerId !== args.ownerId ||
        !allowed.has(embedding.accountId)
      ) {
        continue;
      }
      messageScores.push({
        messageId: embedding.messageId,
        score: match.score,
      });
    }
    return messageScores;
  },
});

async function ownedAllowedAccounts(
  ctx: Pick<QueryCtx, "db">,
  ownerId: string,
  access:
    | { mode: "all" }
    | { mode: "allowlist"; accountIds: Id<"mailAccounts">[] },
) {
  if (access.mode === "allowlist") {
    const accounts = await Promise.all(
      access.accountIds.map(async (accountId) => await ctx.db.get(accountId)),
    );
    return accounts.filter(
      (account): account is Doc<"mailAccounts"> => account?.ownerId === ownerId,
    );
  }
  const owned = await ctx.db
    .query("mailAccounts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .take(50);
  const allowedIds = new Set(
    filterAllowedAccountIds(
      access,
      owned.map((account) => account._id),
    ),
  );
  return owned.filter((account) => allowedIds.has(account._id));
}

async function ownedClassification(
  ctx: Pick<QueryCtx, "db">,
  ownerId: string,
  messageId: Id<"messages">,
) {
  const classification = await ctx.db
    .query("messageClassifications")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .first();
  return classification?.ownerId === ownerId ? classification : null;
}

async function searchPage(
  ctx: Pick<QueryCtx, "db">,
  args: {
    accountId?: Id<"mailAccounts">;
    ownerId: string;
    paginationOpts: { cursor: string | null; numItems: number };
    plan: ReturnType<typeof parseMailSearch>;
  },
) {
  if (args.plan.lexicalQuery) {
    return await ctx.db
      .query("messages")
      .withSearchIndex("search_headers", (q) => {
        const owner = q
          .search("searchText", args.plan.lexicalQuery)
          .eq("ownerId", args.ownerId)
          .eq("inInbox", true);
        return args.accountId ? owner.eq("accountId", args.accountId) : owner;
      })
      .paginate(args.paginationOpts);
  }
  return await ctx.db
    .query("messages")
    .withIndex("by_owner_inbox_received", (q) =>
      q.eq("ownerId", args.ownerId).eq("inInbox", true),
    )
    .order("desc")
    .paginate(args.paginationOpts);
}
