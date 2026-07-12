import { describe, expect, it } from "vitest";

import {
  getTrackedReadStateChanges,
  ICLOUD_SYNC_LOOKBACK_MS,
  parseICloudSyncCursor,
  planIncrementalMailboxSync,
  planInitialMailboxSync,
  recentWindowCutoff,
} from "./window";

describe("iCloud recent sync window initialization", () => {
  it("uses a fixed 30-day cutoff for safe initialization", () => {
    const now = Date.UTC(2026, 6, 11, 12);
    expect(recentWindowCutoff(now).getTime()).toBe(
      now - ICLOUD_SYNC_LOOKBACK_MS,
    );
  });

  it("initializes from only the newest 200 recent UIDs", () => {
    const plan = planInitialMailboxSync({
      recentUids: range(1, 250),
      importedUids: new Set(),
      mailboxHighWaterUid: 5_000,
      uidValidity: "42",
    });

    expect(plan.pendingUids).toEqual(range(51, 250));
    expect(plan.nextCursor).toEqual({
      uidValidity: "42",
      highWaterUid: 5_000,
      trackedUids: range(51, 250),
    });
    expect(plan.deletedRemoteMessageIds).toEqual([]);
  });

  it("does not restart archive crawling after a legacy or missing cursor", () => {
    expect(
      parseICloudSyncCursor(
        JSON.stringify({ version: 2, completedAt: 1, mailboxCount: 3 }),
      ),
    ).toBeUndefined();

    const plan = planInitialMailboxSync({
      recentUids: range(4_001, 4_250),
      importedUids: new Set(range(1, 4_100)),
      mailboxHighWaterUid: 4_250,
      uidValidity: "42",
    });
    expect(plan.pendingUids).toEqual(range(4_101, 4_250));
    expect(plan.nextCursor.highWaterUid).toBe(4_250);
  });
});

describe("iCloud recent sync window progression", () => {
  it("makes repeated scheduled runs idempotent", () => {
    const plan = planIncrementalMailboxSync({
      cursor: {
        uidValidity: "42",
        highWaterUid: 250,
        trackedUids: range(51, 250),
      },
      existingTrackedUids: range(51, 250),
      imported: range(51, 250).map((uid) => imported(uid)),
      mailboxHighWaterUid: 250,
      newUids: [],
    });
    expect(plan.pendingUids).toEqual([]);
    expect(plan.deletedRemoteMessageIds).toEqual([]);
    expect(plan.nextCursor.highWaterUid).toBe(250);
    expect(plan.nextCursor.trackedUids).toEqual(range(51, 250));
  });

  it("drains a burst of new mail over bounded incremental runs", () => {
    const first = planIncrementalMailboxSync({
      cursor: { uidValidity: "42", highWaterUid: 100, trackedUids: [99, 100] },
      existingTrackedUids: [99, 100],
      imported: [imported(99), imported(100)],
      mailboxHighWaterUid: 550,
      newUids: range(101, 550),
    });
    expect(first.pendingUids).toEqual(range(101, 300));
    expect(first.nextCursor.highWaterUid).toBe(300);

    const second = planIncrementalMailboxSync({
      cursor: first.nextCursor,
      existingTrackedUids: first.nextCursor.trackedUids,
      imported: first.nextCursor.trackedUids.map((uid) => imported(uid)),
      mailboxHighWaterUid: 550,
      newUids: range(301, 550),
    });
    expect(second.pendingUids).toEqual(range(301, 500));
    expect(second.nextCursor.highWaterUid).toBe(500);

    const third = planIncrementalMailboxSync({
      cursor: second.nextCursor,
      existingTrackedUids: second.nextCursor.trackedUids,
      imported: second.nextCursor.trackedUids.map((uid) => imported(uid)),
      mailboxHighWaterUid: 550,
      newUids: range(501, 550),
    });
    expect(third.pendingUids).toEqual(range(501, 550));
    expect(third.nextCursor.highWaterUid).toBe(550);
  });

  it("reconciles deletions only inside the tracked current generation", () => {
    const plan = planIncrementalMailboxSync({
      cursor: {
        uidValidity: "42",
        highWaterUid: 250,
        trackedUids: [200, 201, 202],
      },
      existingTrackedUids: [200, 202],
      imported: [
        imported(199),
        imported(200),
        imported(201),
        imported(202),
        { ...imported(201), uidValidity: "41", remoteMessageId: "old-gen" },
      ],
      mailboxHighWaterUid: 250,
      newUids: [],
    });
    expect(plan.deletedRemoteMessageIds).toEqual(["remote-201"]);
    expect(plan.nextCursor.trackedUids).toEqual([200, 202]);
  });

  it("reconciles external read changes only for tracked current messages", () => {
    const changes = getTrackedReadStateChanges({
      cursor: {
        uidValidity: "42",
        highWaterUid: 250,
        trackedUids: [200, 201, 202],
      },
      imported: [
        { ...imported(199), isRead: false },
        { ...imported(200), isRead: false },
        { ...imported(201), isRead: true },
        { ...imported(202), isRead: true },
        {
          ...imported(201),
          uidValidity: "41",
          remoteMessageId: "old-gen",
          isRead: true,
        },
      ],
      observed: [
        { uid: 199, isRead: true },
        { uid: 200, isRead: true },
        { uid: 201, isRead: true },
        { uid: 202, isRead: false },
      ],
    });

    expect(changes).toEqual([
      { remoteMessageId: "remote-200", isRead: true },
      { remoteMessageId: "remote-202", isRead: false },
    ]);
  });
});

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function imported(uid: number) {
  return {
    mailbox: "INBOX",
    uidValidity: "42",
    uid,
    remoteMessageId: `remote-${uid}`,
  };
}
