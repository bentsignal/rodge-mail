import type { PaginationOptions } from "convex/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { AuthedQueryCtx } from "../utils";
import { authedQuery } from "../utils";
import {
  ensureListableAccount,
  ensureOwnedMessage,
  getActiveAccount,
  toMessageDetail,
  toMessageListItem,
} from "./helpers";
import {
  enrichAllMailPage,
  enrichMessagePage,
  enrichThreadPage,
  getVisibleUnreadCountSummary,
} from "./queryEnrichment";
import { isAllMailLocation } from "./location";
import { emptyMessagePage, matchesMailSearch, parseMailSearch } from "./search";
import { matchesUnreadScope } from "./unread";

const vMailSearchScope = v.union(v.literal("all"), v.literal("inbox"));

export const getUnreadCounts = authedQuery({
  args: {},
  handler: async (ctx) => await getVisibleUnreadCountSummary(ctx),
});

export const listInbox = authedQuery({
  args: {
    accountId: v.optional(v.id("mailAccounts")),
    paginationOpts: paginationOptsValidator,
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId, paginationOpts } = args;
    if (accountId) {
      await ensureListableAccount(ctx, ctx.ownerId, accountId);
      return await enrichThreadPage(
        ctx,
        await ctx.db
          .query("threads")
          .withIndex("by_account_pin_latest", (q) =>
            q.eq("accountId", accountId),
          )
          .order("desc")
          .filter((q) =>
            args.unreadOnly
              ? q.and(
                  q.neq(q.field("inInbox"), false),
                  q.gt(q.field("unreadCount"), 0),
                )
              : q.neq(q.field("inInbox"), false),
          )
          .paginate(paginationOpts),
      );
    }

    return await enrichThreadPage(
      ctx,
      await ctx.db
        .query("threads")
        .withIndex("by_owner_pin_latest", (q) => q.eq("ownerId", ctx.ownerId))
        .order("desc")
        .filter((q) =>
          args.unreadOnly
            ? q.and(
                q.neq(q.field("inInbox"), false),
                q.gt(q.field("unreadCount"), 0),
              )
            : q.neq(q.field("inInbox"), false),
        )
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
      await ensureListableAccount(ctx, ctx.ownerId, accountId);
      return await enrichThreadPage(
        ctx,
        await ctx.db
          .query("threads")
          .withIndex("by_account_pin_latest", (q) =>
            q.eq("accountId", accountId),
          )
          .order("desc")
          .filter((q) =>
            q.and(
              q.neq(q.field("inInbox"), false),
              q.neq(q.field("isPinned"), false),
            ),
          )
          .paginate(paginationOpts),
        true,
      );
    }
    return await enrichThreadPage(
      ctx,
      await ctx.db
        .query("threads")
        .withIndex("by_owner_pin_latest", (q) => q.eq("ownerId", ctx.ownerId))
        .order("desc")
        .filter((q) =>
          q.and(
            q.neq(q.field("inInbox"), false),
            q.neq(q.field("isPinned"), false),
          ),
        )
        .paginate(paginationOpts),
      true,
    );
  },
});

export const listAllMail = authedQuery({
  args: {
    accountId: v.optional(v.id("mailAccounts")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { accountId, paginationOpts } = args;
    if (accountId) {
      await ensureListableAccount(ctx, ctx.ownerId, accountId);
      return await enrichAllMailPage(
        ctx,
        await ctx.db
          .query("threads")
          .withIndex("by_account_latest", (q) => q.eq("accountId", accountId))
          .order("desc")
          .paginate(paginationOpts),
      );
    }
    return await enrichAllMailPage(
      ctx,
      await ctx.db
        .query("threads")
        .withIndex("by_owner_latest", (q) => q.eq("ownerId", ctx.ownerId))
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
  args: {
    messageIds: v.array(v.id("messages")),
    unreadOnly: v.optional(v.boolean()),
    scope: v.optional(vMailSearchScope),
  },
  handler: async (ctx, args) => {
    const messageIds = args.messageIds.slice(0, 50);
    const inboxOnly = args.scope !== "all";
    const messages = await Promise.all(
      messageIds.map(async (messageId) => await ctx.db.get(messageId)),
    );
    const items = await Promise.all(
      messages
        .filter(
          (message): message is Doc<"messages"> =>
            message?.ownerId === ctx.ownerId &&
            (message.inInbox || !inboxOnly) &&
            matchesUnreadScope(args.unreadOnly, message),
        )
        .map(async (message) => await toMessageListItem(ctx, message)),
    );
    return items.filter(
      (message): message is NonNullable<typeof message> =>
        message !== null &&
        message.classification?.isSpam !== true &&
        (inboxOnly || isAllMailLocation(message, message.location)),
    );
  },
});

export const getThread = authedQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (thread && thread.ownerId !== ctx.ownerId) {
      throw new ConvexError("Thread not found");
    }
    // Gone, or its account is being removed: readers show "not found".
    if (!thread) return null;
    const [account, messages] = await Promise.all([
      getActiveAccount(ctx, thread.accountId),
      ctx.db
        .query("messages")
        .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
        .order("asc")
        .collect(),
    ]);
    if (!account) return null;

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

export const listSpam = authedQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const classifications = await ctx.db
      .query("messageClassifications")
      .withIndex("by_owner_spam_updated", (q) =>
        q.eq("ownerId", ctx.ownerId).eq("isSpam", true),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      classifications.page.map(async (classification) => {
        const message = await ctx.db.get(classification.messageId);
        if (!message?.inInbox || message.ownerId !== ctx.ownerId) return null;
        return await toMessageListItem(ctx, message);
      }),
    );
    return {
      ...classifications,
      page: page.filter((message): message is NonNullable<typeof message> =>
        Boolean(message),
      ),
    };
  },
});

export const searchHeaders = authedQuery({
  args: {
    accountId: v.optional(v.id("mailAccounts")),
    searchTerm: v.string(),
    paginationOpts: paginationOptsValidator,
    unreadOnly: v.optional(v.boolean()),
    scope: v.optional(vMailSearchScope),
  },
  handler: async (ctx, args) => {
    if (args.accountId) {
      await ensureListableAccount(ctx, ctx.ownerId, args.accountId);
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
    const inboxOnly = args.scope !== "all";
    const results = searchPlan.lexicalQuery
      ? await ctx.db
          .query("messages")
          .withSearchIndex("search_headers", (q) => {
            const byOwner = q
              .search("searchText", searchPlan.lexicalQuery)
              .eq("ownerId", ctx.ownerId);
            const byScope = inboxOnly ? byOwner.eq("inInbox", true) : byOwner;
            const byAccount = accountId
              ? byScope.eq("accountId", accountId)
              : byScope;
            return args.unreadOnly ? byAccount.eq("isRead", false) : byAccount;
          })
          .paginate(args.paginationOpts)
      : await paginateByReceivedDate(ctx, {
          accountId,
          after: searchPlan.after ?? 0,
          before: searchPlan.before ?? Number.MAX_SAFE_INTEGER,
          inboxOnly,
          paginationOpts: args.paginationOpts,
          unreadOnly: args.unreadOnly === true,
        });

    const filtered = {
      ...results,
      page: results.page.filter((message) =>
        matchesMailSearch(message, searchPlan),
      ),
    };

    return await enrichMessagePage(
      ctx,
      filtered,
      inboxOnly ? "inbox" : "all",
    );
  },
});

async function paginateByReceivedDate(
  ctx: AuthedQueryCtx,
  args: {
    accountId: Id<"mailAccounts"> | undefined;
    after: number;
    before: number;
    inboxOnly: boolean;
    paginationOpts: PaginationOptions;
    unreadOnly: boolean;
  },
) {
  const { accountId, after, before } = args;
  const messages = ctx.db.query("messages");
  const range = accountId
    ? args.inboxOnly
      ? messages.withIndex("by_account_inbox_received", (q) =>
          q
            .eq("accountId", accountId)
            .eq("inInbox", true)
            .gte("receivedAt", after)
            .lt("receivedAt", before),
        )
      : messages.withIndex("by_account_received", (q) =>
          q
            .eq("accountId", accountId)
            .gte("receivedAt", after)
            .lt("receivedAt", before),
        )
    : args.inboxOnly
      ? messages.withIndex("by_owner_inbox_received", (q) =>
          q
            .eq("ownerId", ctx.ownerId)
            .eq("inInbox", true)
            .gte("receivedAt", after)
            .lt("receivedAt", before),
        )
      : messages.withIndex("by_owner_received", (q) =>
          q
            .eq("ownerId", ctx.ownerId)
            .gte("receivedAt", after)
            .lt("receivedAt", before),
        );
  return await range
    .order("desc")
    .filter((q) => {
      const visible = args.inboxOnly
        ? q.eq(q.field("inInbox"), true)
        : q.eq(q.field("hiddenAt"), undefined);
      return args.unreadOnly
        ? q.and(visible, q.eq(q.field("isRead"), false))
        : visible;
    })
    .paginate(args.paginationOpts);
}
