import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { MAX_JOB_ATTEMPTS } from "./constants";
import { normalizeMail, stableHash } from "./normalize";

export const CLASSIFICATION_JOB_STALE_AFTER_MS = 15 * 60 * 1000;
export const CLASSIFICATION_RECOVERY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const CLASSIFICATION_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

type RecoverableClassification = Pick<
  Doc<"messageClassifications">,
  "attempt" | "nextAttemptAt" | "source" | "status" | "updatedAt"
>;

type RecoverableMessage = Pick<Doc<"messages">, "inInbox" | "receivedAt">;

export function classificationRecoveryPlan(
  classification: RecoverableClassification,
  message: RecoverableMessage | null,
  now: number,
) {
  if (!isDueUnfinishedJob(classification, now)) return null;
  if (!isCurrentInboxMessage(message, now)) return "discard";
  return (classification.attempt ?? 0) >= MAX_JOB_ATTEMPTS
    ? "fallback"
    : "retry";
}

function isDueUnfinishedJob(
  classification: RecoverableClassification,
  now: number,
) {
  const unfinished =
    classification.status === "pending" || classification.status === "running";
  const retryDue =
    classification.status !== "pending" ||
    classification.nextAttemptAt === undefined ||
    classification.nextAttemptAt <= now;
  return (
    classification.source !== "manual" &&
    unfinished &&
    retryDue &&
    classification.updatedAt <= now - CLASSIFICATION_JOB_STALE_AFTER_MS
  );
}

export function isCurrentInboxMessage(
  message: RecoverableMessage | null,
  now: number,
) {
  return Boolean(
    message?.inInbox &&
      message.receivedAt >= now - CLASSIFICATION_RECOVERY_MAX_AGE_MS &&
      message.receivedAt <= now + CLASSIFICATION_FUTURE_TOLERANCE_MS,
  );
}

export async function isClassificationInputStale(
  ctx: MutationCtx,
  classification: Doc<"messageClassifications">,
) {
  if (!classification.inputHash) return false;
  const [message, content] = await Promise.all([
    ctx.db.get(classification.messageId),
    ctx.db
      .query("messageContents")
      .withIndex("by_message", (q) =>
        q.eq("messageId", classification.messageId),
      )
      .first(),
  ]);
  if (!message) return false;
  return (
    stableHash(normalizeMail(message, content)) !== classification.inputHash
  );
}
