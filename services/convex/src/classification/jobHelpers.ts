import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { MAX_JOB_ATTEMPTS } from "./constants";

export function classificationRetryDelay(attempt: number) {
  if (attempt <= 1) return 5_000;
  if (attempt === 2) return 30_000;
  return 120_000;
}

export function assertProbability(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ConvexError(`${field} must be between 0 and 1`);
  }
}

export function isClassificationRunnable(
  classification: Doc<"messageClassifications">,
  jobKey: string,
) {
  if (classification.jobKey !== jobKey) return false;
  if (classification.source === "manual") return false;
  if (
    classification.status !== "pending" &&
    classification.status !== "failed"
  ) {
    return false;
  }
  if ((classification.attempt ?? 0) >= MAX_JOB_ATTEMPTS) return false;
  return (
    classification.nextAttemptAt === undefined ||
    classification.nextAttemptAt <= Date.now()
  );
}
