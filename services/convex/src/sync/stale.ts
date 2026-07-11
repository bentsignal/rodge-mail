export const SYNC_RUN_STALE_AFTER_MS = 10 * 60 * 1000;

export const STALE_SYNC_ERROR =
  "Sync stopped before it could finish. Retry this account.";

interface SyncRunState {
  status: "failed" | "pending" | "running" | "succeeded";
  updatedAt: number;
}

interface AccountSyncRunState extends SyncRunState {
  accountId: string;
}

export function isStaleSyncRun(run: SyncRunState, now: number) {
  return (
    (run.status === "pending" || run.status === "running") &&
    run.updatedAt <= now - SYNC_RUN_STALE_AFTER_MS
  );
}

export function canFinishSyncRun(status: SyncRunState["status"]) {
  return status === "running";
}

export function getActiveSyncAccountIds(runs: AccountSyncRunState[]) {
  return new Set(
    runs.flatMap((run) =>
      run.status === "pending" || run.status === "running"
        ? [run.accountId]
        : [],
    ),
  );
}
