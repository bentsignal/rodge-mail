import { v } from "convex/values";

import {
  ensureOwnedMessage,
  getClassificationForMessage,
} from "../mail/helpers";
import { authedQuery } from "../utils";

export const getForMessage = authedQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    await ensureOwnedMessage(ctx, ctx.ownerId, args.messageId);
    return await getClassificationForMessage(ctx, args.messageId);
  },
});
