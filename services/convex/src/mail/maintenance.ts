/* eslint-disable complexity -- This repair intentionally requires every independent malformed-row signature before mutating data. */
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import {
  collectMessageRecords,
  deleteMessageRecords,
  recalculateThreadAfterCleanup,
} from "./cleanupRecords";
import {
  summarizeICloudCleanup,
  validateICloudCleanupArgs,
} from "./icloudCleanup";
import { getThreadProjectionUpdate } from "./threadState";

export const cleanupOldICloudMessages = internalMutation({
  args: {
    accountId: v.id("mailAccounts"),
    cutoffReceivedAt: v.number(),
    dryRun: v.boolean(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    validateICloudCleanupArgs(args);
    const account = await ctx.db.get(args.accountId);
    if (account?.provider !== "icloud") {
      throw new Error("The cleanup target must be an existing iCloud account");
    }

    const page = await ctx.db
      .query("messages")
      .withIndex("by_account_received", (q) =>
        q
          .eq("accountId", args.accountId)
          .lt("receivedAt", args.cutoffReceivedAt),
      )
      .order("asc")
      .take(args.limit + 1);
    const messages = page.slice(0, args.limit);
    const records = await Promise.all(
      messages.map(
        async (message) => await collectMessageRecords(ctx, message),
      ),
    );
    const threadIds = new Set(messages.map((message) => message.threadId));
    const storageIds = new Set(records.flatMap((record) => record.storageIds));
    const counts = summarizeICloudCleanup(
      records.map((record) => ({
        attachments: record.attachments.length,
        classifications: record.classifications.length,
        contents: record.contents.length,
        embeddingJobs: record.embeddingJobs.length,
        embeddings: record.embeddings.length,
        notificationDeliveries: record.deliveries.length,
        notificationPushTickets: record.tickets.length,
        storageIds: record.storageIds,
        threadId: record.message.threadId,
      })),
    );

    if (!args.dryRun) {
      for (const storageId of storageIds) await ctx.storage.delete(storageId);
      for (const record of records) await deleteMessageRecords(ctx, record);
      for (const threadId of threadIds) {
        await recalculateThreadAfterCleanup(ctx, threadId);
      }
    }

    return {
      accountId: account._id,
      accountAddress: account.address,
      cutoffReceivedAt: args.cutoffReceivedAt,
      dryRun: args.dryRun,
      hasMore: page.length > args.limit,
      counts,
      messageIds: messages.map((message) => message._id),
    };
  },
});

export const backfillThreadInboxProjection = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("threads").paginate(args.paginationOpts);
    await Promise.all(
      result.page.map(async (thread) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_thread_received", (q) => q.eq("threadId", thread._id))
          .collect();
        await ctx.db.patch(thread._id, {
          ...getThreadProjectionUpdate(thread.latestMessageAt, messages),
          updatedAt: Date.now(),
        });
      }),
    );
    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      processed: result.page.length,
    };
  },
});

export const repairMalformedMicrosoftMessage = internalMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return { repaired: false, reason: "not_found" } as const;
    const [account, thread, contents, attachments] = await Promise.all([
      ctx.db.get(message.accountId),
      ctx.db.get(message.threadId),
      ctx.db
        .query("messageContents")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect(),
      ctx.db
        .query("attachments")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect(),
    ]);
    if (
      !account ||
      !thread ||
      !isMalformedPlaceholder({
        account,
        attachments,
        contents,
        message,
        thread,
      })
    ) {
      return { repaired: false, reason: "signature_mismatch" } as const;
    }

    const [classifications, jobs, embeddings] = await Promise.all([
      ctx.db
        .query("messageClassifications")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect(),
      ctx.db
        .query("messageEmbeddingJobs")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect(),
      ctx.db
        .query("messageEmbeddings")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect(),
    ]);
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(message._id, {
        hiddenAt: now,
        inInbox: false,
        isPinned: false,
        updatedAt: now,
      }),
      ctx.db.patch(thread._id, {
        unreadCount: 0,
        inInbox: false,
        isPinned: false,
        latestInboxMessageAt: undefined,
        latestInboxMessageId: undefined,
        updatedAt: now,
      }),
      ...[...contents, ...classifications, ...jobs, ...embeddings].map(
        async (row) => await ctx.db.delete(row._id),
      ),
    ]);
    return { repaired: true, reason: "placeholder_delta" } as const;
  },
});

function isMalformedPlaceholder({
  account,
  attachments,
  contents,
  message,
  thread,
}: {
  account: Doc<"mailAccounts">;
  attachments: Doc<"attachments">[];
  contents: Doc<"messageContents">[];
  message: Doc<"messages">;
  thread: Doc<"threads">;
}) {
  const hasBody = contents.some((content) =>
    [
      content.plainText?.trim(),
      content.sanitizedHtml?.trim(),
      content.htmlStorageId,
      content.rawStorageId,
    ].some(Boolean),
  );
  return (
    account.provider === "microsoft" &&
    message.from.address === "unknown@invalid" &&
    message.subject === "(no subject)" &&
    message.snippet.trim() === "" &&
    message.to.length === 0 &&
    message.cc.length === 0 &&
    message.bcc.length === 0 &&
    (message.replyTo?.length ?? 0) === 0 &&
    thread.remoteThreadId === message.remoteMessageId &&
    attachments.length === 0 &&
    !hasBody
  );
}
