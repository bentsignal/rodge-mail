import type { LucideIcon } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import {
  Archive,
  BriefcaseBusiness,
  Cloud,
  Inbox,
  Mail,
  PenLine,
  ShieldAlert,
} from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { MailAccountFilter } from "../store";
import type { MailAccountView } from "../types";
import { QuickLink } from "~/components/quick-link";
import { PasskeyManagementButton } from "~/features/auth/components/passkey-management-button";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { useMailboxNavigation } from "../use-mailbox-navigation";
import { AccountManagerButton } from "./account-manager-dialog";
import {
  getAccountButtonLabel,
  getAccountRailMailboxTarget,
} from "./account-rail-presentation";
import { SyncAllButton } from "./sync-all-button";

const ACCOUNT_ICONS = {
  gmail: Mail,
  icloud: Cloud,
  microsoft: BriefcaseBusiness,
} satisfies Record<MailAccountView["provider"], LucideIcon>;

export function AccountRail() {
  const isArchive = useRouterState({
    select: (state) => state.location.pathname.startsWith("/archive"),
  });
  const isSpam = useRouterState({
    select: (state) => state.location.pathname.startsWith("/spam"),
  });
  const accountFilter = useMailStore((store) => store.accountFilter);
  const clearSelection = useMailStore((store) => store.clearSelection);
  const selectMailbox = useMailboxNavigation(getAccountRailMailboxTarget());
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

      <AccountRailNavigation
        accountFilter={accountFilter}
        accounts={accounts}
        isArchive={isArchive}
        isLoadingAccounts={isLoadingAccounts}
        isSpam={isSpam}
        selectMailbox={selectMailbox}
        unreadCounts={unreadCounts}
        onClearSelection={clearSelection}
      />

      <div className="mt-3 shrink-0 border-t border-white/10 pt-3">
        <div className="grid grid-cols-1 gap-1 rounded-xl border border-white/[0.08] bg-black/10 p-1 xl:grid-cols-2">
          <SyncAllButton
            accounts={accounts}
            isSyncing={isSyncingAccounts}
            onSync={syncAllAccounts}
          />
          <PasskeyManagementButton compact />
        </div>
      </div>
    </aside>
  );
}

function AccountRailNavigation({
  accountFilter,
  accounts,
  isArchive,
  isLoadingAccounts,
  isSpam,
  onClearSelection,
  selectMailbox,
  unreadCounts,
}: {
  accountFilter: MailAccountFilter;
  accounts: MailAccountView[];
  isArchive: boolean;
  isLoadingAccounts: boolean;
  isSpam: boolean;
  onClearSelection: () => void;
  selectMailbox: (accountId: MailAccountFilter) => void;
  unreadCounts: Record<string, number>;
}) {
  return (
    <nav
      aria-label="Mail accounts"
      className="mail-scrollbar mt-5 min-h-0 flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto"
    >
      <AccountButton
        active={!isArchive && !isSpam && accountFilter === "all"}
        count={unreadCounts.all}
        icon={Inbox}
        label="All Inboxes"
        onClick={() => selectMailbox("all")}
      />
      <QuickLink
        aria-label="Archive"
        aria-current={isArchive ? "page" : undefined}
        className={cn(
          "group relative flex h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-sm transition-colors xl:justify-start",
          isArchive
            ? "border border-white/10 bg-white/[0.09] text-[var(--mail-chassis-foreground)] shadow-[var(--warm-shadow-inset)] after:absolute after:inset-y-2 after:left-0 after:w-0.5 after:rounded-r after:bg-[var(--mail-brass)]"
            : "border border-transparent text-[var(--mail-chassis-foreground)]/72 hover:border-white/10 hover:bg-white/[0.07] hover:text-[var(--mail-chassis-foreground)]",
        )}
        onClick={onClearSelection}
        to="/archive"
      >
        <Archive className="size-[18px]" strokeWidth={1.7} />
        <span className="hidden truncate xl:block">Archive</span>
      </QuickLink>
      <QuickLink
        aria-label="Spam"
        aria-current={isSpam ? "page" : undefined}
        className={cn(
          "group relative flex h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-sm transition-colors xl:justify-start",
          isSpam
            ? "border border-white/10 bg-white/[0.09] text-[var(--mail-chassis-foreground)] shadow-[var(--warm-shadow-inset)] after:absolute after:inset-y-2 after:left-0 after:w-0.5 after:rounded-r after:bg-[var(--mail-brass)]"
            : "border border-transparent text-[var(--mail-chassis-foreground)]/72 hover:border-white/10 hover:bg-white/[0.07] hover:text-[var(--mail-chassis-foreground)]",
        )}
        onClick={onClearSelection}
        to="/spam"
      >
        <ShieldAlert className="size-[18px]" strokeWidth={1.7} />
        <span className="hidden truncate xl:block">Spam</span>
      </QuickLink>
      <div className="mx-3 mt-4 mb-2.5 border-t border-white/10" />
      <div className="mb-1 flex items-center justify-center px-1 xl:justify-between xl:pl-3">
        <p className="hidden font-mono text-[9px] tracking-[0.14em] text-[var(--mail-chassis-foreground)]/48 uppercase xl:block">
          Accounts
        </p>
        <AccountManagerButton accounts={accounts} />
      </div>
      {accounts.map((account) => {
        const Icon = ACCOUNT_ICONS[account.provider];
        return (
          <AccountButton
            active={!isArchive && !isSpam && accountFilter === account._id}
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
    </nav>
  );
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
