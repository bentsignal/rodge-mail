import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { authedQuery } from "../utils";
import { ensureOwnedAccount, toArchivedThreadListItem } from "./helpers";

export const listArchive = authedQuery({
  args: {
    accountId: v.optional(v.id("mailAccounts")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const accountId = args.accountId;
    if (accountId) {
      await ensureOwnedAccount(ctx, ctx.ownerId, accountId);
    }
    const result = accountId
      ? await ctx.db
          .query("threads")
          .withIndex("by_account_archived", (q) =>
            q.eq("accountId", accountId).gt("archivedAt", 0),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("threads")
          .withIndex("by_owner_archived", (q) =>
            q.eq("ownerId", ctx.ownerId).gt("archivedAt", 0),
          )
          .order("desc")
          .paginate(args.paginationOpts);
    const { page, ...pagination } = result;
    const items = await Promise.all(
      page.map(async (thread) => await toArchivedThreadListItem(ctx, thread)),
    );
    return {
      ...pagination,
      page: items.filter(
        (item): item is NonNullable<typeof item> => item !== null,
      ),
    };
  },
});
