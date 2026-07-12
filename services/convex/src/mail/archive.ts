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
  existing: { archivedAt?: number; hiddenAt?: number } | null | undefined,
  tombstone: unknown,
) {
  return (
    (tombstone !== null && tombstone !== undefined) ||
    existing?.archivedAt !== undefined ||
    existing?.hiddenAt !== undefined
  );
}

export function validateArchiveCleanupLimit(limit: number) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_ARCHIVE_CLEANUP_BATCH
  ) {
    throw new Error(
      `Archive cleanup limit must be an integer between 1 and ${MAX_ARCHIVE_CLEANUP_BATCH}`,
    );
  }
}

export function getRestoredInboxFlags(
  messages: {
    archivedFromInbox?: boolean;
    direction: "incoming" | "outgoing";
  }[],
) {
  const inferred = messages.map(
    (message) => message.archivedFromInbox ?? message.direction === "incoming",
  );
  if (inferred.some(Boolean) || inferred.length === 0) return inferred;
  return inferred.map((_, index) => index === inferred.length - 1);
}

export function isPermanentlyDeletableArchive(
  thread: { archivedAt?: number; inInbox?: boolean },
  messages: { archivedAt?: number; inInbox: boolean }[],
) {
  return (
    thread.inInbox === false &&
    (thread.archivedAt !== undefined ||
      messages.some((item) => item.archivedAt !== undefined)) &&
    messages.length > 0 &&
    messages.every(
      (message) => message.archivedAt !== undefined && !message.inInbox,
    )
  );
}
