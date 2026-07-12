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
import { useMailboxNavigation } from "../use-mailbox-navigation";
import { getAccountButtonLabel } from "./account-rail-presentation";
import { AddAccountButton } from "./provider-connection-buttons";

const ACCOUNT_ICONS = {
  gmail: Mail,
  icloud: Cloud,
  microsoft: BriefcaseBusiness,
} satisfies Record<MailAccountView["provider"], LucideIcon>;

export function AccountRail() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const selectMailbox = useMailboxNavigation();
  const openComposer = useMailStore((store) => store.openComposer);
  const {
    accounts,
    isLoadingAccounts,
    isSyncingAccounts,
    syncAllAccounts,
    unreadCounts,
  } = useLiveMail();

  return (
    <aside className="mail-account-rail mail-chassis relative z-10 hidden h-full w-[76px] shrink-0 flex-col px-2.5 py-4 md:flex xl:w-[216px] xl:px-4">
      <Brand />
      <button
        aria-label="New message"
        className="mail-brass-button mt-5 flex h-11 items-center justify-center gap-2.5 rounded-lg px-3 text-sm font-bold transition-colors xl:justify-start xl:px-4"
        onClick={openComposer}
        type="button"
      >
        <PenLine className="size-[17px]" />
        <span className="hidden xl:inline">New</span>
      </button>

      <nav
        aria-label="Mail accounts"
        className="mail-scrollbar mt-5 min-h-0 flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto"
      >
        <AccountButton
          active={accountFilter === "all"}
          count={unreadCounts.all}
          icon={Inbox}
          label="All Inboxes"
          onClick={() => selectMailbox("all")}
        />
        <div className="mx-3 mt-4 mb-3 border-t border-white/10" />
        <p className="mb-1 hidden px-3 font-mono text-[9px] tracking-[0.14em] text-[var(--mail-chassis-foreground)]/48 uppercase xl:block">
          Accounts
        </p>
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
              accessibleLabel={`${account.label}, ${getProviderLabel(account.provider)}, ${account.address}`}
              onClick={() => selectMailbox(account._id)}
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
        <div className="mx-3 mb-3 border-t border-white/10" />
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
          ? "text-[#ff9a7f] hover:bg-white/[0.08]"
          : "text-[var(--mail-chassis-foreground)]/65 hover:bg-white/[0.08] hover:text-[var(--mail-chassis-foreground)]",
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
    <div className="mail-brand flex min-h-10 items-center justify-center gap-3 xl:justify-start xl:px-1">
      <img
        alt="Rodge Mail"
        className="size-10 shrink-0 rounded-[10px] border border-[var(--mail-brass-deep)] shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_5px_12px_rgba(0,0,0,0.24)]"
        src="/icon-192.png"
      />
      <div className="hidden min-w-0 xl:block">
        <p className="font-serif text-[16px] leading-5 font-semibold tracking-[-0.02em] whitespace-nowrap text-[var(--mail-chassis-foreground)]">
          Rodge Mail
        </p>
      </div>
    </div>
  );
}

function AccountButton({
  accent,
  accessibleLabel,
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  accent?: string;
  accessibleLabel?: string;
  active: boolean;
  count: number | undefined;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={getAccountButtonLabel(accessibleLabel ?? label, count)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-sm transition-colors xl:justify-start",
        active
          ? "border border-white/10 bg-white/[0.09] text-[var(--mail-chassis-foreground)] shadow-[var(--warm-shadow-inset)] after:absolute after:inset-y-2 after:left-0 after:w-0.5 after:rounded-r after:bg-[var(--mail-brass)]"
          : "border border-transparent text-[var(--mail-chassis-foreground)]/72 hover:border-white/10 hover:bg-white/[0.07] hover:text-[var(--mail-chassis-foreground)]",
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
      className="absolute -right-1 -bottom-1 size-2 rounded-full ring-2 ring-[var(--mail-chassis)]"
      style={{ backgroundColor: accent }}
    />
  );
}

function getProviderLabel(provider: MailAccountView["provider"]) {
  if (provider === "gmail") return "Gmail";
  if (provider === "icloud") return "iCloud";
  return "Microsoft 365";
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
      aria-hidden="true"
      className={cn(
        "absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full px-1 py-0.5 font-mono text-[8px] tabular-nums xl:static xl:ml-auto xl:min-w-5 xl:px-1.5 xl:text-[9px]",
        active
          ? "bg-[var(--mail-brass)] text-[#251c0e]"
          : "bg-white/10 text-[var(--mail-chassis-foreground)]",
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
          className="h-9 animate-pulse rounded-lg bg-white/[0.07]"
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
