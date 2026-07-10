import { authedQuery } from "../utils";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("mailAccounts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
      .collect();
  },
});
