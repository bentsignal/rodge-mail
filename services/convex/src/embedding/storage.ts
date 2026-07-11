import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { EmbeddingReason } from "../classification/constants";
import { isImportantMessage } from "../classification/importance";

type ReadCtx = Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">;

interface EmbeddingSelectionPlan {
  preserveSelected: boolean;
  reason: EmbeddingReason | null;
  deleteReason: EmbeddingReason | undefined;
}

export async function findEmbeddingJob(
  ctx: ReadCtx,
  messageId: Id<"messages">,
) {
  return await ctx.db
    .query("messageEmbeddingJobs")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .first();
}

export async function findMessageEmbedding(
  ctx: ReadCtx,
  messageId: Id<"messages">,
) {
  return await ctx.db
    .query("messageEmbeddings")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .first();
}

export async function deleteEmbeddingRecords(
  ctx: MutationCtx,
  messageId: Id<"messages">,
  onlyReason?: EmbeddingReason,
) {
  const [job, embedding] = await Promise.all([
    findEmbeddingJob(ctx, messageId),
    findMessageEmbedding(ctx, messageId),
  ]);
  if (shouldDelete(job?.reason, onlyReason) && job)
    await ctx.db.delete(job._id);
  if (shouldDelete(embedding?.reason, onlyReason) && embedding) {
    await ctx.db.delete(embedding._id);
  }
}

export function hasSelectedReason(
  jobReason: EmbeddingReason | undefined,
  embeddingReason: EmbeddingReason | undefined,
) {
  return jobReason === "selected" || embeddingReason === "selected";
}

export function embeddingSelectionPlan(args: {
  clearSelected: boolean;
  inInbox: boolean;
  isPinned: boolean;
  importance: number | undefined;
  jobReason: EmbeddingReason | undefined;
  embeddingReason: EmbeddingReason | undefined;
}) {
  const preserveSelected =
    !args.clearSelected &&
    hasSelectedReason(args.jobReason, args.embeddingReason);
  const reason = desiredReason(args.inInbox, args.isPinned, args.importance);
  return {
    preserveSelected,
    reason,
    deleteReason: preserveSelected ? undefined : reasonToDelete(args, reason),
  } satisfies EmbeddingSelectionPlan;
}

function reasonToDelete(
  args: {
    clearSelected: boolean;
    jobReason: EmbeddingReason | undefined;
    embeddingReason: EmbeddingReason | undefined;
  },
  desired: EmbeddingReason | null,
) {
  if (args.clearSelected) return "selected";
  const hasPinned =
    args.jobReason === "pinned" || args.embeddingReason === "pinned";
  if (desired === "important" && hasPinned) return "pinned";
  if (desired) return undefined;
  return args.jobReason ?? args.embeddingReason;
}

export function desiredReason(
  inInbox: boolean,
  isPinned: boolean,
  importance: number | undefined,
) {
  if (!inInbox) return null;
  if (isPinned) return "pinned" satisfies EmbeddingReason;
  if (isImportantMessage(importance))
    return "important" satisfies EmbeddingReason;
  return null;
}

export function preferredReason(
  requested: EmbeddingReason,
  embedded: EmbeddingReason | undefined,
  queued: EmbeddingReason | undefined,
) {
  const candidates = [requested, embedded, queued].filter(isReason);
  return (
    candidates.sort((left, right) => priority(right) - priority(left))[0] ??
    requested
  );
}

function shouldDelete(
  reason: EmbeddingReason | undefined,
  onlyReason: EmbeddingReason | undefined,
) {
  if (!reason) return false;
  return onlyReason === undefined || reason === onlyReason;
}

function priority(reason: EmbeddingReason) {
  if (reason === "selected") return 3;
  if (reason === "pinned") return 2;
  if (reason === "important" || reason === "focused") return 1;
  return 0;
}

function isReason(
  value: EmbeddingReason | undefined,
): value is EmbeddingReason {
  return value !== undefined;
}
