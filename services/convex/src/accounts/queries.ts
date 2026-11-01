import { isActiveAccount } from "../mail/helpers";
import { authedQuery } from "../utils";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db
      .query("mailAccounts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
      .collect();
    return accounts.filter(isActiveAccount);
  },
});
