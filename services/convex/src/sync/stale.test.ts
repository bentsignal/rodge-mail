import { describe, expect, it } from "vitest";

import {
  canFinishSyncRun,
  getActiveSyncAccountIds,
  getOrphanedSyncAccountIds,
  isStaleSyncRun,
  SYNC_RUN_STALE_AFTER_MS,
} from "./stale";

describe("stale sync runs", () => {
  const now = 20 * 60 * 1000;

  it.each(["pending", "running"] as const)(
    "expires an abandoned %s run",
    (status) => {
      expect(
        isStaleSyncRun(
          { status, updatedAt: now - SYNC_RUN_STALE_AFTER_MS },
          now,
        ),
      ).toBe(true);
    },
  );

  it("keeps a recently updated run active", () => {
    expect(
      isStaleSyncRun(
        { status: "running", updatedAt: now - SYNC_RUN_STALE_AFTER_MS + 1 },
        now,
      ),
    ).toBe(false);
  });

  it.each(["failed", "succeeded"] as const)(
    "does not expire a completed %s run",
    (status) => {
      expect(isStaleSyncRun({ status, updatedAt: 0 }, now)).toBe(false);
    },
  );

  it("rejects late completion after recovery has failed a run", () => {
    expect(canFinishSyncRun("running")).toBe(true);
    expect(canFinishSyncRun("failed")).toBe(false);
  });

  it("does not fail an account while a newer run is still active", () => {
    expect(
      getActiveSyncAccountIds([
        { accountId: "account-1", status: "failed", updatedAt: 1 },
        { accountId: "account-1", status: "running", updatedAt: 2 },
        { accountId: "account-2", status: "succeeded", updatedAt: 2 },
      ]),
    ).toEqual(new Set(["account-1"]));
  });

  it("finds an old syncing account without an active run", () => {
    expect(
      getOrphanedSyncAccountIds(
        [
          {
            accountId: "orphaned",
            status: "syncing",
            updatedAt: now - SYNC_RUN_STALE_AFTER_MS,
          },
          {
            accountId: "active",
            status: "syncing",
            updatedAt: now - SYNC_RUN_STALE_AFTER_MS,
          },
        ],
        new Set(["active"]),
        now,
      ),
    ).toEqual(["orphaned"]);
  });

  it("keeps a new syncing account while its run is being scheduled", () => {
    expect(
      getOrphanedSyncAccountIds(
        [
          {
            accountId: "account-1",
            status: "syncing",
            updatedAt: now - SYNC_RUN_STALE_AFTER_MS + 1,
          },
        ],
        new Set(),
        now,
      ),
    ).toEqual([]);
  });

  it("ignores settled account states without an active run", () => {
    expect(
      getOrphanedSyncAccountIds(
        [
          { accountId: "connected", status: "connected", updatedAt: 0 },
          { accountId: "failed", status: "error", updatedAt: 0 },
        ],
        new Set(),
        now,
      ),
    ).toEqual([]);
  });
});
