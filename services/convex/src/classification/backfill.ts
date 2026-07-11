import {
  CLASSIFICATION_FUTURE_TOLERANCE_MS,
  CLASSIFICATION_RECOVERY_MAX_AGE_MS,
} from "./stale";

export const RECENT_BACKFILL_LIMIT = 200;
export const RECENT_BACKFILL_PAGE_SIZE = 10;
export const RECENT_BACKFILL_PAGE_DELAY_MS = 20_000;

export function recentBackfillBounds(now: number) {
  return {
    cutoff: now - CLASSIFICATION_RECOVERY_MAX_AGE_MS,
    upperBound: now + CLASSIFICATION_FUTURE_TOLERANCE_MS,
  };
}

export function nextBackfillRemaining(remaining: number, scanned: number) {
  return Math.max(
    0,
    Math.min(RECENT_BACKFILL_LIMIT, Math.floor(remaining)) -
      Math.max(0, Math.floor(scanned)),
  );
}
