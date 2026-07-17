import type { Doc } from "../_generated/dataModel";
import type { AuthedQueryCtx } from "../utils";
import { toMessageListItem, toThreadListItem } from "./helpers";
import { getUnreadCountSummary } from "./unreadCounts";

export async function getVisibleUnreadCountSummary(ctx: AuthedQueryCtx) {
  const threads = await ctx.db
    .query("threads")
    .withIndex("by_owner_unread", (q) =>
      q.eq("ownerId", ctx.ownerId).gt("unreadCount", 0),
    )
    .filter((q) => q.neq(q.field("inInbox"), false))
    .collect();
  const visibleThreads = await Promise.all(
    threads.map(async (thread) => ({
      item: await toThreadListItem(ctx, thread),
      thread,
    })),
  );
  return getUnreadCountSummary(
    visibleThreads
      .filter(({ item }) => item?.classification?.isSpam !== true)
      .map(({ thread }) => thread),
  );
}

export async function enrichMessagePage<T extends { page: Doc<"messages">[] }>(
  ctx: AuthedQueryCtx,
  results: T,
) {
  const page = await Promise.all(
    results.page.map(async (message) => {
      return await toMessageListItem(ctx, message);
    }),
  );
  return {
    ...results,
    page: page.filter((message) => message.classification?.isSpam !== true),
  };
}

export async function enrichThreadPage<T extends { page: Doc<"threads">[] }>(
  ctx: AuthedQueryCtx,
  results: T,
  pinnedOnly = false,
) {
  const { page, ...pagination } = results;
  const items = await Promise.all(
    page.map(async (thread) => await toThreadListItem(ctx, thread)),
  );
  return {
    ...pagination,
    page: items.filter(
      (item): item is NonNullable<typeof item> =>
        item !== null &&
        item.classification?.isSpam !== true &&
        (!pinnedOnly || item.isPinned),
    ),
  };
}
