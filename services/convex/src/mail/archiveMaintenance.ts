import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import {
  getArchiveRetentionCutoff,
  validateArchiveCleanupLimit,
} from "./archive";
import {
  collectMessageRecords,
  deleteMessageRecords,
  recalculateThreadAfterCleanup,
} from "./cleanupRecords";

export const cleanupArchivedMessages = internalMutation({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    validateArchiveCleanupLimit(args.limit);
    const cutoffArchivedAt = getArchiveRetentionCutoff(Date.now());
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_archived", (q) =>
        q.gt("archivedAt", 0).lt("archivedAt", cutoffArchivedAt),
      )
      .order("asc")
      .take(args.limit + 1);
    const page = messages.slice(0, args.limit);
    const records = await Promise.all(
      page.map(async (message) => await collectMessageRecords(ctx, message)),
    );
    const threadIds = new Set(page.map((message) => message.threadId));
    const storageIds = new Set(records.flatMap((record) => record.storageIds));

    for (const storageId of storageIds) await ctx.storage.delete(storageId);
    for (const record of records) await deleteMessageRecords(ctx, record);
    for (const threadId of threadIds) {
      await recalculateThreadAfterCleanup(ctx, threadId);
    }

    return {
      cutoffArchivedAt,
      deletedMessages: page.length,
      hasMore: messages.length > args.limit,
    };
  },
});
