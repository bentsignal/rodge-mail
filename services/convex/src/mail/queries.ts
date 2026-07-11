import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { AuthedQueryCtx } from "../utils";
import { authedQuery } from "../utils";
import {
  ensureOwnedAccount,
  ensureOwnedMessage,
  ensureOwnedThread,
  toMessageDetail,
  toMessageListItem,
} from "./helpers";
import { matchesMailSearch, parseMailSearch } from "./search";

export const listInbox = authedQuery({
  args: {
    accountId: v.optional(v.id("mailAccounts")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { accountId, paginationOpts } = args;
    if (accountId) {
      await ensureOwnedAccount(ctx, ctx.ownerId, accountId);
      return await enrichPage(
        ctx,
        await ctx.db
          .query("messages")
          .withIndex("by_account_inbox_received", (q) =>
            q.eq("accountId", accountId).eq("inInbox", true),
          )
          .order("desc")
          .paginate(paginationOpts),
      );
    }

    return await enrichPage(
      ctx,
      await ctx.db
        .query("messages")
        .withIndex("by_owner_inbox_received", (q) =>
          q.eq("ownerId", ctx.ownerId).eq("inInbox", true),
        )
        .order("desc")
        .paginate(paginationOpts),
    );
  },
});

export const listPinned = authedQuery({
  args: {
    accountId: v.optional(v.id("mailAccounts")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { accountId, paginationOpts } = args;
    if (accountId) {
      await ensureOwnedAccount(ctx, ctx.ownerId, accountId);
      return await enrichPage(
        ctx,
        await ctx.db
          .query("messages")
          .withIndex("by_account_inbox_pinned_received", (q) =>
            q
              .eq("accountId", accountId)
              .eq("inInbox", true)
              .eq("isPinned", true),
          )
          .order("desc")
          .paginate(paginationOpts),
      );
    }
    return await enrichPage(
      ctx,
      await ctx.db
        .query("messages")
        .withIndex("by_owner_inbox_pinned_received", (q) =>
          q.eq("ownerId", ctx.ownerId).eq("inInbox", true).eq("isPinned", true),
        )
        .order("desc")
        .paginate(paginationOpts),
    );
  },
});

export const getMessage = authedQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ensureOwnedMessage(ctx, ctx.ownerId, args.messageId);
    return await toMessageDetail(ctx, message);
  },
});

export const getMessagesByIds = authedQuery({
  args: { messageIds: v.array(v.id("messages")) },
  handler: async (ctx, args) => {
    const messageIds = args.messageIds.slice(0, 50);
    const messages = await Promise.all(
      messageIds.map(async (messageId) => await ctx.db.get(messageId)),
    );
    return await Promise.all(
      messages
        .filter(
          (message): message is Doc<"messages"> =>
            message?.ownerId === ctx.ownerId && message.inInbox,
        )
        .map(async (message) => await toMessageListItem(ctx, message)),
    );
  },
});

export const getThread = authedQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ensureOwnedThread(ctx, ctx.ownerId, args.threadId);
    const [account, messages] = await Promise.all([
      ensureOwnedAccount(ctx, ctx.ownerId, thread.accountId),
      ctx.db
        .query("messages")
        .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
        .order("asc")
        .collect(),
    ]);

    return {
      ...thread,
      account,
      messages: await Promise.all(
        messages.map(async (message) => {
          return await toMessageDetail(ctx, message);
        }),
      ),
    };
  },
});

export const searchHeaders = authedQuery({
  args: {
    accountId: v.optional(v.id("mailAccounts")),
    searchTerm: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (args.accountId) {
      await ensureOwnedAccount(ctx, ctx.ownerId, args.accountId);
    }
    const searchPlan = parseMailSearch(args.searchTerm);
    if (
      !searchPlan.lexicalQuery &&
      searchPlan.after === undefined &&
      searchPlan.before === undefined
    ) {
      return emptyMessagePage();
    }

    const accountId = args.accountId;
    const results = searchPlan.lexicalQuery
      ? await ctx.db
          .query("messages")
          .withSearchIndex("search_headers", (q) => {
            const byOwner = q
              .search("searchText", searchPlan.lexicalQuery)
              .eq("ownerId", ctx.ownerId)
              .eq("inInbox", true);
            return accountId ? byOwner.eq("accountId", accountId) : byOwner;
          })
          .paginate(args.paginationOpts)
      : accountId
        ? await ctx.db
            .query("messages")
            .withIndex("by_account_inbox_received", (q) => {
              const range = q.eq("accountId", accountId).eq("inInbox", true);
              if (
                searchPlan.after !== undefined &&
                searchPlan.before !== undefined
              ) {
                return range
                  .gte("receivedAt", searchPlan.after)
                  .lt("receivedAt", searchPlan.before);
              }
              if (searchPlan.after !== undefined) {
                return range.gte("receivedAt", searchPlan.after);
              }
              if (searchPlan.before !== undefined) {
                return range.lt("receivedAt", searchPlan.before);
              }
              return range;
            })
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("messages")
            .withIndex("by_owner_inbox_received", (q) => {
              const range = q.eq("ownerId", ctx.ownerId).eq("inInbox", true);
              if (
                searchPlan.after !== undefined &&
                searchPlan.before !== undefined
              ) {
                return range
                  .gte("receivedAt", searchPlan.after)
                  .lt("receivedAt", searchPlan.before);
              }
              if (searchPlan.after !== undefined) {
                return range.gte("receivedAt", searchPlan.after);
              }
              if (searchPlan.before !== undefined) {
                return range.lt("receivedAt", searchPlan.before);
              }
              return range;
            })
            .order("desc")
            .paginate(args.paginationOpts);

    const filtered = {
      ...results,
      page: results.page.filter((message) =>
        matchesMailSearch(message, searchPlan),
      ),
    };

    return await enrichPage(ctx, filtered);
  },
});

async function enrichPage<T extends { page: Doc<"messages">[] }>(
  ctx: AuthedQueryCtx,
  results: T,
) {
  return {
    ...results,
    page: await Promise.all(
      results.page.map(async (message) => {
        return await toMessageListItem(ctx, message);
      }),
    ),
  };
}

function emptyMessagePage() {
  return {
    page: [],
    isDone: true,
    continueCursor: "",
  };
}
