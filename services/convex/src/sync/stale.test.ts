import { describe, expect, it } from "vitest";

import {
  canFinishSyncRun,
  getActiveSyncAccountIds,
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
});
