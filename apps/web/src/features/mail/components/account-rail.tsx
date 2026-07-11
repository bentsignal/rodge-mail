import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BriefcaseBusiness,
  Cloud,
  Inbox,
  Mail,
  PenLine,
  RefreshCw,
} from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { MailAccountView } from "../types";
import { PasskeyManagementButton } from "~/features/auth/components/passkey-management-button";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { AddAccountButton } from "./provider-connection-buttons";

const ACCOUNT_ICONS = {
  gmail: Mail,
  icloud: Cloud,
  microsoft: BriefcaseBusiness,
} satisfies Record<MailAccountView["provider"], LucideIcon>;

export function AccountRail() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const openComposer = useMailStore((store) => store.openComposer);
  const {
    accounts,
    isLoadingAccounts,
    isSyncingAccounts,
    syncAllAccounts,
    unreadCounts,
  } = useLiveMail();

  return (
    <aside className="relative z-10 hidden h-full w-[82px] shrink-0 flex-col px-2.5 py-4 md:flex xl:w-[244px] xl:px-4">
      <Brand />
      <button
        aria-label="New message"
        className="mt-8 flex h-11 items-center justify-center gap-2.5 rounded-xl bg-[var(--mail-brand)] px-3 text-sm font-semibold text-[var(--mail-brand-foreground)] shadow-[0_8px_24px_rgba(32,37,31,0.14)] transition-colors hover:bg-[var(--mail-brand-hover)] xl:justify-start xl:px-4"
        onClick={openComposer}
        type="button"
      >
        <PenLine className="size-[17px]" />
        <span className="hidden xl:inline">New</span>
      </button>

      <nav aria-label="Mail accounts" className="mt-8 space-y-1.5">
        <AccountButton
          active={accountFilter === "all"}
          count={unreadCounts.all}
          icon={Inbox}
          label="Unified inbox"
          onClick={() => setAccountFilter("all")}
        />
        <div className="border-border/80 mx-3 my-3 border-t" />
        {accounts.map((account) => {
          const Icon = ACCOUNT_ICONS[account.provider];
          return (
            <AccountButton
              active={accountFilter === account._id}
              accent={account.accent}
              count={unreadCounts[account._id]}
              icon={Icon}
              key={account._id}
              label={account.label}
              onClick={() => setAccountFilter(account._id)}
            />
          );
        })}
        <AccountLoadingState isLoading={isLoadingAccounts} />
        <AddAccountButton accounts={accounts} />
        <SyncAllButton
          accounts={accounts}
          isSyncing={isSyncingAccounts}
          onSync={syncAllAccounts}
        />
      </nav>

      <div className="mt-auto space-y-1.5">
        <div className="border-border/80 mx-3 mb-3 border-t" />
        <PasskeyManagementButton />
      </div>
    </aside>
  );
}

function SyncAllButton({
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
        "group flex h-10 w-full items-center justify-center gap-3 rounded-xl px-3 text-xs transition-colors xl:justify-start",
        state === "failed"
          ? "text-[#b95d41] hover:bg-[#b95d41]/8 dark:text-[#e58b6d]"
          : "text-[#756c62] hover:bg-black/[0.035] hover:text-[#20251f] dark:text-[#aaa195] dark:hover:bg-white/[0.05] dark:hover:text-[#f8f1e6]",
      )}
      disabled={accounts.length === 0 || isSyncing}
      onClick={() => void onSync()}
      title={failedAccounts[0]?.lastSyncError ?? label}
      type="button"
    >
      <Icon className={cn("size-[17px]", isSyncing && "animate-spin")} />
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

function Brand() {
  return (
    <div className="flex items-center justify-center gap-3 xl:justify-start xl:px-2">
      <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-[var(--mail-brand)] text-[var(--mail-brand-foreground)] shadow-sm">
        <span className="font-serif text-xl italic">R</span>
        <span className="absolute right-1.5 bottom-1.5 size-1 rounded-full bg-[var(--mail-highlight)]" />
      </div>
      <div className="hidden min-w-0 xl:block">
        <p className="font-serif text-[17px] leading-5 font-semibold tracking-[-0.02em]">
          Rodge Mail
        </p>
      </div>
    </div>
  );
}

function AccountButton({
  accent,
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  accent?: string;
  active: boolean;
  count: number | undefined;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 w-full items-center justify-center gap-3 rounded-xl px-3 text-sm transition-colors xl:justify-start",
        active
          ? "text-foreground bg-[var(--mail-selected)] shadow-[inset_0_0_0_1px_rgba(82,67,48,0.06)]"
          : "text-[#6e665d] hover:bg-black/[0.035] hover:text-[#20251f] dark:text-[#aaa195] dark:hover:bg-white/[0.05] dark:hover:text-[#f8f1e6]",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="relative shrink-0">
        <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.7} />
        <AccountAccent accent={accent} />
      </span>
      <span className="hidden truncate xl:block">{label}</span>
      <UnreadCount active={active} count={count} />
    </button>
  );
}

function AccountAccent({ accent }: { accent: string | undefined }) {
  if (!accent) return null;

  return (
    <span
      className="ring-background absolute -right-1 -bottom-1 size-2 rounded-full ring-2"
      style={{ backgroundColor: accent }}
    />
  );
}

function UnreadCount({
  active,
  count,
}: {
  active: boolean;
  count: number | undefined;
}) {
  if (!count) return null;

  return (
    <span
      className={cn(
        "ml-auto hidden min-w-5 rounded-full px-1.5 py-0.5 font-mono text-[9px] tabular-nums xl:block",
        active
          ? "bg-[var(--mail-brand)] text-[var(--mail-brand-foreground)]"
          : "bg-black/[0.055]",
      )}
    >
      {count}
    </span>
  );
}

function AccountSkeletons() {
  return (
    <div aria-label="Loading accounts" className="space-y-2 px-3 py-1">
      {[0, 1, 2].map((index) => (
        <div
          className="h-9 animate-pulse rounded-lg bg-black/[0.045] dark:bg-white/[0.05]"
          key={index}
        />
      ))}
    </div>
  );
}

function AccountLoadingState({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;
  return <AccountSkeletons />;
}
