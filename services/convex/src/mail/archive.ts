import { v } from "convex/values";

export const ARCHIVE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_ARCHIVE_CLEANUP_BATCH = 100;

export const vArchivedMessageTombstone = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  remoteMessageId: v.string(),
  archivedAt: v.number(),
  createdAt: v.number(),
});

export function getArchiveRetentionCutoff(now: number) {
  return now - ARCHIVE_RETENTION_MS;
}

export function isProviderMessageArchived(
  existing:
    | { archivedAt?: number; hiddenAt?: number }
    | null
    | undefined,
  tombstone: unknown,
) {
  return (
    (tombstone !== null && tombstone !== undefined) ||
    existing?.archivedAt !== undefined ||
    existing?.hiddenAt !== undefined
  );
}

export function validateArchiveCleanupLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ARCHIVE_CLEANUP_BATCH) {
    throw new Error(
      `Archive cleanup limit must be an integer between 1 and ${MAX_ARCHIVE_CLEANUP_BATCH}`,
    );
  }
}
