import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { buildThreadAfterMessageCleanup } from "./icloudCleanup";

export type CleanupRecord = Awaited<ReturnType<typeof collectMessageRecords>>;

export async function collectMessageRecords(
  ctx: MutationCtx,
  message: Doc<"messages">,
) {
  const [
    contents,
    attachments,
    classifications,
    embeddingJobs,
    embeddings,
    deliveries,
  ] = await Promise.all([
    ctx.db
      .query("messageContents")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .collect(),
    ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .collect(),
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
    ctx.db
      .query("notificationDeliveries")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .collect(),
  ]);
  const tickets = (
    await Promise.all(
      deliveries.map(async (delivery) =>
        ctx.db
          .query("notificationPushTickets")
          .withIndex("by_delivery", (q) => q.eq("deliveryId", delivery._id))
          .collect(),
      ),
    )
  ).flat();
  const storageIds = [
    ...contents.flatMap((content) => [
      content.htmlStorageId,
      content.rawStorageId,
    ]),
    ...attachments.map((attachment) => attachment.storageId),
  ].filter((storageId): storageId is Id<"_storage"> => storageId !== undefined);
  return {
    message,
    contents,
    attachments,
    classifications,
    embeddingJobs,
    embeddings,
    deliveries,
    tickets,
    storageIds,
  };
}

export async function deleteMessageRecords(
  ctx: MutationCtx,
  record: CleanupRecord,
) {
  for (const row of [
    ...record.tickets,
    ...record.deliveries,
    ...record.contents,
    ...record.attachments,
    ...record.classifications,
    ...record.embeddingJobs,
    ...record.embeddings,
  ]) {
    await ctx.db.delete(row._id);
  }
  await ctx.db.delete(record.message._id);
}

export async function recalculateThreadAfterCleanup(
  ctx: MutationCtx,
  threadId: Id<"threads">,
) {
  const thread = await ctx.db.get(threadId);
  if (!thread) return;
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_thread_received", (q) => q.eq("threadId", threadId))
    .collect();
  const update = buildThreadAfterMessageCleanup(messages, Date.now());
  if (update) await ctx.db.patch(threadId, update);
  else await ctx.db.delete(threadId);
}
