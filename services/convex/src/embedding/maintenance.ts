import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { isStaleEmbeddingJob } from "./stale";
import {
  deleteEmbeddingRecords,
  embeddingSelectionPlan,
  findMessageEmbedding,
} from "./storage";

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

export const recoverStaleJobs = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 50)));
    const candidates = (
      await Promise.all(
        (["pending", "running"] as const).map(async (status) => {
          return await ctx.db
            .query("messageEmbeddingJobs")
            .withIndex("by_status", (q) => q.eq("status", status))
            .take(limit);
        }),
      )
    ).flat();
    const staleJobs = candidates
      .filter((job) => isStaleEmbeddingJob(job, now))
      .slice(0, limit);
    let recovered = 0;
    let removed = 0;

    for (const job of staleJobs) {
      const [classification, embedding, message] = await Promise.all([
        ctx.db
          .query("messageClassifications")
          .withIndex("by_message", (q) => q.eq("messageId", job.messageId))
          .first(),
        findMessageEmbedding(ctx, job.messageId),
        ctx.db.get(job.messageId),
      ]);
      if (!message) {
        await ctx.db.delete(job._id);
        removed += 1;
        continue;
      }
      const plan = embeddingSelectionPlan({
        clearSelected: false,
        embeddingReason: embedding?.reason,
        importance: classification?.importance,
        inInbox: message.inInbox,
        isPinned: message.isPinned,
        jobReason: job.reason,
      });
      const reason = plan.preserveSelected ? "selected" : plan.reason;
      if (!reason) {
        await deleteEmbeddingRecords(ctx, message._id);
        removed += 1;
        continue;
      }
      await ctx.db.patch(job._id, {
        attempt: 0,
        error: undefined,
        nextAttemptAt: undefined,
        reason,
        status: "pending",
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, RUN_EMBEDDING, {
        jobKey: job.jobKey,
        messageId: job.messageId,
      });
      recovered += 1;
    }

    return { recovered, removed, scanned: candidates.length };
  },
});
