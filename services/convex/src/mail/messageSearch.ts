import type { PaginationOptions } from "convex/server";

import type { Id } from "../_generated/dataModel";
import type { AuthedQueryCtx } from "../utils";
import type { parseMailSearch } from "./search";

interface MessageSearchArgs {
  accountId: Id<"mailAccounts"> | undefined;
  inboxOnly: boolean;
  paginationOpts: PaginationOptions;
  plan: ReturnType<typeof parseMailSearch>;
  unreadOnly: boolean;
}

/**
 * One page of search candidates: the full-text index when there are words to
 * match, otherwise a received-date index range. Inbox-only unless asked for
 * all mail; callers still apply the plan's sender, subject, and date checks.
 */
export async function paginateMessageSearch(
  ctx: AuthedQueryCtx,
  args: MessageSearchArgs,
) {
  const { accountId, plan } = args;
  if (!plan.lexicalQuery) {
    return await paginateByReceivedDate(ctx, {
      ...args,
      after: plan.after ?? 0,
      before: plan.before ?? Number.MAX_SAFE_INTEGER,
    });
  }
  return await ctx.db
    .query("messages")
    .withSearchIndex("search_headers", (q) => {
      const byOwner = q
        .search("searchText", plan.lexicalQuery)
        .eq("ownerId", ctx.ownerId);
      const byScope = args.inboxOnly ? byOwner.eq("inInbox", true) : byOwner;
      const byAccount = accountId
        ? byScope.eq("accountId", accountId)
        : byScope;
      return args.unreadOnly ? byAccount.eq("isRead", false) : byAccount;
    })
    .paginate(args.paginationOpts);
}

async function paginateByReceivedDate(
  ctx: AuthedQueryCtx,
  args: MessageSearchArgs & { after: number; before: number },
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
