import { v } from "convex/values";

import { authedMutation } from "../utils";
import { queueCleanViewForMessage } from "./queue";

export const generate = authedMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await queueCleanViewForMessage(ctx, {
      ownerId: ctx.ownerId,
      messageId: args.messageId,
      regenerate: true,
    });
  },
});
