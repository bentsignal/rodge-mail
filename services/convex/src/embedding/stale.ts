import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { MAX_JOB_ATTEMPTS } from "../classification/constants";
import {
  embeddingText,
  normalizeMail,
  stableHash,
} from "../classification/normalize";

export async function isEmbeddingInputStale(
  ctx: MutationCtx,
  job: Doc<"messageEmbeddingJobs">,
) {
  const [message, content] = await Promise.all([
    ctx.db.get(job.messageId),
    ctx.db
      .query("messageContents")
      .withIndex("by_message", (q) => q.eq("messageId", job.messageId))
      .first(),
  ]);
  if (!message) return false;
  const contentHash = stableHash(
    embeddingText(normalizeMail(message, content)),
  );
  return contentHash !== job.contentHash;
}

export function isEmbeddingJobRunnable(
  job: Doc<"messageEmbeddingJobs">,
  jobKey: string,
) {
  if (job.jobKey !== jobKey) return false;
  if (job.status !== "pending" && job.status !== "failed") return false;
  if (job.attempt >= MAX_JOB_ATTEMPTS) return false;
  return job.nextAttemptAt === undefined || job.nextAttemptAt <= Date.now();
}
