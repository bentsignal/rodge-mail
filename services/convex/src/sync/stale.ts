export const SYNC_RUN_STALE_AFTER_MS = 10 * 60 * 1000;

export const STALE_SYNC_ERROR =
  "Sync stopped before it could finish. Retry this account.";

interface SyncRunState {
  status: "failed" | "pending" | "running" | "succeeded";
  updatedAt: number;
}

interface AccountSyncRunState<AccountId extends string> extends SyncRunState {
  accountId: AccountId;
}

interface MailAccountSyncState<AccountId extends string> {
  accountId: AccountId;
  status:
    | "connected"
    | "disconnected"
    | "error"
    | "reauthorization_required"
    | "syncing";
  updatedAt: number;
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

export function canStartSyncRun(status: SyncRunState["status"]) {
  return status === "pending";
}

export function getActiveSyncAccountIds<AccountId extends string>(
  runs: AccountSyncRunState<AccountId>[],
) {
  return new Set(
    runs.flatMap((run) =>
      run.status === "pending" || run.status === "running"
        ? [run.accountId]
        : [],
    ),
  );
}

export function getOrphanedSyncAccountIds<AccountId extends string>(
  accounts: MailAccountSyncState<AccountId>[],
  activeAccountIds: ReadonlySet<AccountId>,
  now: number,
) {
  const cutoff = now - SYNC_RUN_STALE_AFTER_MS;
  return accounts.flatMap((account) =>
    account.status === "syncing" &&
    account.updatedAt <= cutoff &&
    !activeAccountIds.has(account.accountId)
      ? [account.accountId]
      : [],
  );
}
