import { v } from "convex/values";

import { createMessageSearchText } from "../mail/search";
import { authedMutation } from "../utils";
import { queueEmbeddingForMessage } from "./internal";

const BACKFILL_BATCH_SIZE = 25;

export const backfillInboxIndexing = authedMutation({
  args: {
    apply: v.boolean(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("messages")
      .withIndex("by_owner_inbox_received", (q) =>
        q.eq("ownerId", ctx.ownerId).eq("inInbox", true),
      )
      .order("desc")
      .paginate({ cursor: args.cursor, numItems: BACKFILL_BATCH_SIZE });

    let missingEmbeddings = 0;
    let searchTextsNeedingUpdate = 0;
    for (const message of batch.page) {
      const [account, content, embedding] = await Promise.all([
        ctx.db.get(message.accountId),
        ctx.db
          .query("messageContents")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .first(),
        ctx.db
          .query("messageEmbeddings")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .first(),
      ]);
      if (!account || account.ownerId !== ctx.ownerId) continue;
      const searchText = createMessageSearchText({
        accountAddress: account.address,
        body: content?.plainText,
        cc: message.cc,
        from: message.from,
        snippet: message.snippet,
        subject: message.subject,
        to: message.to,
      });
      if (searchText !== message.searchText) searchTextsNeedingUpdate += 1;
      if (!embedding) missingEmbeddings += 1;
      if (!args.apply) continue;
      if (searchText !== message.searchText) {
        await ctx.db.patch(message._id, { searchText });
      }
      await queueEmbeddingForMessage(ctx, {
        ownerId: ctx.ownerId,
        messageId: message._id,
        reason: "inbox",
      });
    }

    return {
      continueCursor: batch.continueCursor,
      isDone: batch.isDone,
      applied: args.apply,
      missingEmbeddings,
      processed: batch.page.length,
      searchTextsNeedingUpdate,
    };
  },
});
