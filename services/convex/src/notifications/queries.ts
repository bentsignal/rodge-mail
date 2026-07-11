import { authedQuery } from "../utils";

export const getPreferences = authedQuery({
  args: {},
  handler: async (ctx) => {
    const preference = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
      .unique();
    return {
      newMailEnabled: preference?.newMailEnabled ?? true,
      includePreview: preference?.includePreview ?? true,
    };
  },
});
