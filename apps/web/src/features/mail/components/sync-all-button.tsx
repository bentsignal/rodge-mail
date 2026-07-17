import { AlertCircle, RefreshCw } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { MailAccountView } from "../types";

export function SyncAllButton({
  accounts,
  isSyncing,
  onSync,
}: {
  accounts: MailAccountView[];
  isSyncing: boolean;
  onSync: () => Promise<void>;
}) {
  const failedAccounts = accounts.filter(
    (account) => account.status === "error" || account.lastSyncError,
  );
  const state = getSyncButtonState(isSyncing, failedAccounts.length);
  const Icon = state === "failed" ? AlertCircle : RefreshCw;
  const label = getSyncButtonLabel(state, failedAccounts.length);
  return (
    <button
      aria-label={label}
      className={cn(
        "group flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-transparent px-2 text-xs transition-colors",
        state === "failed"
          ? "text-[#ff9a7f] hover:bg-white/[0.08]"
          : "text-[var(--mail-chassis-foreground)]/65 hover:bg-white/[0.08] hover:text-[var(--mail-chassis-foreground)]",
      )}
      disabled={accounts.length === 0 || isSyncing}
      onClick={() => void onSync()}
      title={failedAccounts[0]?.lastSyncError ?? label}
      type="button"
    >
      <Icon className={cn("size-4", isSyncing && "animate-spin")} />
      <span className="hidden truncate xl:block">
        <SyncButtonText state={state} />
      </span>
    </button>
  );
}

type SyncButtonState = "failed" | "idle" | "syncing";

function getSyncButtonState(isSyncing: boolean, failedCount: number) {
  if (isSyncing) return "syncing";
  if (failedCount > 0) return "failed";
  return "idle";
}

function getSyncButtonLabel(state: SyncButtonState, failedCount: number) {
  if (state === "syncing") return "Syncing accounts";
  if (state === "failed") {
    return `Retry sync for ${failedCount} account${failedCount === 1 ? "" : "s"}`;
  }
  return "Sync all accounts";
}

function SyncButtonText({ state }: { state: SyncButtonState }) {
  if (state === "syncing") return <>Syncing…</>;
  if (state === "failed") return <>Retry sync</>;
  return <>Sync all</>;
}
