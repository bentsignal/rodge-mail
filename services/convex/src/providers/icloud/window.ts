import { z } from "zod";

import type { parseRemoteMessageId } from "./identifiers";

type ParsedRemoteMessageId = NonNullable<
  ReturnType<typeof parseRemoteMessageId>
>;

interface ImportedMessageState extends ParsedRemoteMessageId {
  remoteMessageId: string;
  isRead: boolean;
}

export const ICLOUD_SYNC_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1_000;
export const ICLOUD_SYNC_MESSAGE_LIMIT = 200;

export interface ICloudMailboxCursor {
  uidValidity: string;
  highWaterUid: number;
  trackedUids: number[];
}

export interface ICloudSyncCursor {
  version: 3;
  completedAt: number;
  mailboxes: Record<string, ICloudMailboxCursor>;
}

const mailboxCursorSchema = z.object({
  uidValidity: z.string(),
  highWaterUid: z.number().int().nonnegative(),
  trackedUids: z.array(z.number().int().positive()),
});

const syncCursorSchema = z.object({
  version: z.literal(3),
  completedAt: z.number().finite(),
  mailboxes: z.record(z.string(), mailboxCursorSchema),
});

export function parseICloudSyncCursor(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed = syncCursorSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return undefined;
    return {
      ...parsed.data,
      mailboxes: Object.fromEntries(
        Object.entries(parsed.data.mailboxes).map(([path, mailbox]) => [
          path,
          {
            ...mailbox,
            trackedUids: normalizeUids(mailbox.trackedUids).slice(
              -ICLOUD_SYNC_MESSAGE_LIMIT,
            ),
          },
        ]),
      ),
    } satisfies ICloudSyncCursor;
  } catch {
    return undefined;
  }
}

export function recentWindowCutoff(now: number) {
  return new Date(now - ICLOUD_SYNC_LOOKBACK_MS);
}

export function planInitialMailboxSync(args: {
  recentUids: number[];
  importedUids: Set<number>;
  mailboxHighWaterUid: number;
  uidValidity: string;
}) {
  const trackedUids = normalizeUids(args.recentUids).slice(
    -ICLOUD_SYNC_MESSAGE_LIMIT,
  );
  return {
    deletedRemoteMessageIds: new Array<string>(),
    pendingUids: trackedUids.filter((uid) => !args.importedUids.has(uid)),
    nextCursor: {
      uidValidity: args.uidValidity,
      highWaterUid: Math.max(args.mailboxHighWaterUid, trackedUids.at(-1) ?? 0),
      trackedUids,
    } satisfies ICloudMailboxCursor,
  };
}

export function planIncrementalMailboxSync(args: {
  cursor: ICloudMailboxCursor;
  existingTrackedUids: number[];
  imported: (ParsedRemoteMessageId & { remoteMessageId: string })[];
  mailboxHighWaterUid: number;
  newUids: number[];
}) {
  const currentTrackedUids = normalizeUids(args.existingTrackedUids).filter(
    (uid) => args.cursor.trackedUids.includes(uid),
  );
  const importedUids = new Set(args.imported.map((item) => item.uid));
  const recoveryUids = currentTrackedUids.filter(
    (uid) => !importedUids.has(uid),
  );
  const newUids = normalizeUids(args.newUids).filter(
    (uid) => uid > args.cursor.highWaterUid,
  );
  const candidates = normalizeUids([...recoveryUids, ...newUids]);
  const pendingUids = candidates.slice(0, ICLOUD_SYNC_MESSAGE_LIMIT);
  const pendingSet = new Set(pendingUids);
  const processedNewUids = newUids.filter((uid) => pendingSet.has(uid));
  const hasMoreNewUids = newUids.some((uid) => !pendingSet.has(uid));
  const nextHighWaterUid = hasMoreNewUids
    ? Math.max(
        args.cursor.highWaterUid,
        processedNewUids.at(-1) ?? args.cursor.highWaterUid,
      )
    : Math.max(args.cursor.highWaterUid, args.mailboxHighWaterUid);
  const trackedUids = normalizeUids([
    ...currentTrackedUids,
    ...pendingUids,
  ]).slice(-ICLOUD_SYNC_MESSAGE_LIMIT);
  const existingTracked = new Set(currentTrackedUids);
  const deletedRemoteMessageIds = args.imported
    .filter(
      (item) =>
        item.uidValidity === args.cursor.uidValidity &&
        args.cursor.trackedUids.includes(item.uid) &&
        !existingTracked.has(item.uid),
    )
    .map((item) => item.remoteMessageId);

  return {
    deletedRemoteMessageIds,
    pendingUids,
    nextCursor: {
      uidValidity: args.cursor.uidValidity,
      highWaterUid: nextHighWaterUid,
      trackedUids,
    } satisfies ICloudMailboxCursor,
  };
}

export function getTrackedReadStateChanges(args: {
  cursor: ICloudMailboxCursor;
  imported: ImportedMessageState[];
  observed: { uid: number; isRead: boolean }[];
}) {
  const observed = new Map(
    args.observed.map((item) => [item.uid, item.isRead]),
  );
  return args.imported.flatMap((item) => {
    const isRead = observed.get(item.uid);
    return item.uidValidity === args.cursor.uidValidity &&
      args.cursor.trackedUids.includes(item.uid) &&
      isRead !== undefined &&
      isRead !== item.isRead
      ? [{ remoteMessageId: item.remoteMessageId, isRead }]
      : [];
  });
}

export function toUidSequence(uids: number[]) {
  return normalizeUids(uids).join(",");
}

function normalizeUids(values: number[]) {
  return [...new Set(values.filter(isPositiveUid))].sort((a, b) => a - b);
}

function isUid(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveUid(value: unknown): value is number {
  return isUid(value) && value > 0;
}
