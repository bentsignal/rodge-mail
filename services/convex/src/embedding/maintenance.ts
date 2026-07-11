import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

interface EmbeddingActionArgs extends Record<string, unknown> {
  messageId: Id<"messages">;
  jobKey: string;
}

const RUN_EMBEDDING = makeFunctionReference<
  "action",
  EmbeddingActionArgs,
  null
>("embedding/actions:runEmbedding");

const vUnfinishedStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("failed"),
);

export const clearUnfinishedInboxJobs = internalMutation({
  args: {
    ownerId: v.string(),
    status: vUnfinishedStatus,
  },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("messageEmbeddingJobs")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerId", args.ownerId).eq("status", args.status),
      )
      .collect();
    const inboxJobs = jobs.filter((job) => job.reason === "inbox");
    await Promise.all(
      inboxJobs.map(async (job) => await ctx.db.delete(job._id)),
    );
    return { deleted: inboxJobs.length };
  },
});

export const retryFailedJobs = internalMutation({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("messageEmbeddingJobs")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerId", args.ownerId).eq("status", "failed"),
      )
      .take(100);
    await Promise.all(
      jobs.map(async (job) => {
        await ctx.db.patch(job._id, {
          attempt: 0,
          error: undefined,
          nextAttemptAt: undefined,
          status: "pending",
          updatedAt: Date.now(),
        });
        await ctx.scheduler.runAfter(0, RUN_EMBEDDING, {
          jobKey: job.jobKey,
          messageId: job.messageId,
        });
      }),
    );
    return { retried: jobs.length };
  },
});
