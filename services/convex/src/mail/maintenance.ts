/* eslint-disable complexity -- This repair intentionally requires every independent malformed-row signature before mutating data. */
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

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
      ctx.db.patch(thread._id, { unreadCount: 0, updatedAt: now }),
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
