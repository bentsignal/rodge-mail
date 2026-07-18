import type { MobileMailAccount } from "../lib/convex-mail";

export type AccountConnectionTone =
  | "danger"
  | "healthy"
  | "info"
  | "neutral"
  | "warning";

export function getAccountConnectionPresentation(
  account: MobileMailAccount,
  now = Date.now(),
) {
  if (account.isDemo) return demoPresentation();
  if (accountNeedsReconnect(account)) return reconnectPresentation(account);
  if (account.status === "error" || getSyncError(account)) {
    return syncIssuePresentation(account);
  }
  if (account.status === "syncing") {
    return {
      canReconnect: false,
      canRetry: false,
      detail: "Checking for new mail now.",
      label: "Syncing",
      tone: "info",
    };
  }
  return {
    canReconnect: false,
    canRetry: false,
    detail: account.lastSyncedAt
      ? `Last synced ${formatElapsedTime(account.lastSyncedAt, now)}.`
      : "Connected and ready to sync.",
    label: "Connected",
    tone: "healthy",
  };
}

export type AccountConnectionPresentation = ReturnType<
  typeof getAccountConnectionPresentation
>;

function demoPresentation() {
  return {
    canReconnect: false,
    canRetry: false,
    detail: "Sample mail does not connect to a provider.",
    label: "Demo",
    tone: "neutral" as const,
  };
}

function accountNeedsReconnect(account: MobileMailAccount) {
  return (
    account.status === "reauthorization_required" ||
    account.status === "disconnected"
  );
}

function reconnectPresentation(account: MobileMailAccount) {
  return {
    canReconnect: true,
    canRetry: false,
    detail:
      getSyncError(account) ??
      "This connection has expired. Reconnect to resume mail sync.",
    label: "Reconnect required",
    tone: "danger" as const,
  };
}

function syncIssuePresentation(account: MobileMailAccount) {
  return {
    canReconnect: true,
    canRetry: true,
    detail:
      getSyncError(account) ??
      "The latest sync did not finish. Try again or reconnect this account.",
    label: "Sync issue",
    tone: "warning" as const,
  };
}

function getSyncError(account: MobileMailAccount) {
  const error = account.lastSyncError?.trim();
  return error?.length ? error : undefined;
}

function formatElapsedTime(timestamp: number, now: number) {
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}
