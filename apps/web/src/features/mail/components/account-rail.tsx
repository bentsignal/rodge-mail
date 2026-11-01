import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  BriefcaseBusiness,
  Cloud,
  Layers,
  Mail,
  PenLine,
} from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { MailMode } from "../live-data-types";
import type { MailAccountFilter } from "../store";
import type { MailAccountView } from "../types";
import { SettingsButton } from "~/features/auth/components/settings-button";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { useMailboxNavigation } from "../use-mailbox-navigation";
import { AccountManagerButton } from "./account-manager-dialog";
import {
  Brand,
  MAILBOXES,
  MailboxLink,
  UnreadCount,
} from "./account-rail-links";
import { getAccountButtonLabel } from "./account-rail-presentation";
import { SyncAllButton } from "./sync-all-button";

const ACCOUNT_ICONS = {
  gmail: Mail,
  hosted: AtSign,
  icloud: Cloud,
  microsoft: BriefcaseBusiness,
} satisfies Record<MailAccountView["provider"], LucideIcon>;

export function AccountRail() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const clearSelection = useMailStore((store) => store.clearSelection);
  const openComposer = useMailStore((store) => store.openComposer);
  const {
    accounts,
    isLoadingAccounts,
    isSyncingAccounts,
    mailMode,
    syncAllAccounts,
    unreadCounts,
  } = useLiveMail();

  return (
    <aside className="mail-account-rail bg-sidebar text-sidebar-foreground border-sidebar-border relative z-10 hidden h-full w-[76px] shrink-0 flex-col border-r px-2.5 py-4 md:flex xl:w-[216px] xl:px-4">
      <Brand />
      <button
        aria-label="New message"
        className="mail-primary-button mt-5 flex h-11 items-center justify-center gap-2.5 rounded-lg px-3 text-sm font-bold transition-colors xl:justify-start xl:px-4"
        onClick={openComposer}
        type="button"
      >
        <PenLine className="size-[17px]" />
        <span className="hidden xl:inline">New</span>
      </button>

      <AccountRailNavigation
        accountFilter={accountFilter}
        accounts={accounts}
        isLoadingAccounts={isLoadingAccounts}
        mailMode={mailMode}
        unreadCounts={unreadCounts}
        onClearSelection={clearSelection}
      />

      <div className="border-sidebar-border mt-3 shrink-0 border-t pt-3">
        <div className="grid grid-cols-1 gap-1 p-1 xl:grid-cols-2">
          <SyncAllButton
            accounts={accounts}
            isSyncing={isSyncingAccounts}
            onSync={syncAllAccounts}
          />
          <SettingsButton />
        </div>
      </div>
    </aside>
  );
}

function AccountRailNavigation({
  accountFilter,
  accounts,
  isLoadingAccounts,
  mailMode,
  onClearSelection,
  unreadCounts,
}: {
  accountFilter: MailAccountFilter;
  accounts: MailAccountView[];
  isLoadingAccounts: boolean;
  mailMode: MailMode;
  onClearSelection: () => void;
  unreadCounts: Record<string, number>;
}) {
  const selectAccount = useMailboxNavigation(mailMode);
  return (
    <nav
      aria-label="Mailboxes and accounts"
      className="mail-scrollbar mt-5 min-h-0 flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto"
    >
      {MAILBOXES.map((mailbox) => (
        <MailboxLink
          active={mailMode === mailbox.mode}
          count={
            mailbox.mode === "inbox" ? unreadCounts[accountFilter] : undefined
          }
          icon={mailbox.icon}
          key={mailbox.mode}
          label={mailbox.label}
          onClick={onClearSelection}
          to={mailbox.to}
        />
      ))}
      <div className="border-sidebar-border mx-3 mt-4 mb-2.5 border-t" />
      <div className="mb-1 flex items-center justify-center px-1 xl:justify-between xl:pl-3">
        <p className="text-muted-foreground hidden text-[11px] font-medium tracking-wide uppercase xl:block">
          Accounts
        </p>
        <AccountManagerButton accounts={accounts} />
      </div>
      <AccountButton
        active={accountFilter === "all"}
        count={unreadCounts.all}
        icon={Layers}
        label="All Accounts"
        onClick={() => selectAccount("all")}
      />
      {accounts.map((account) => {
        const Icon = ACCOUNT_ICONS[account.provider];
        return (
          <AccountButton
            active={accountFilter === account._id}
            count={unreadCounts[account._id]}
            icon={Icon}
            key={account._id}
            label={account.label}
            accessibleLabel={`${account.label}, ${getProviderLabel(account.provider)}, ${account.address}`}
            onClick={() => selectAccount(account._id)}
          />
        );
      })}
      <AccountLoadingState isLoading={isLoadingAccounts} />
    </nav>
  );
}

function AccountButton({
  accessibleLabel,
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
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
      aria-pressed={active}
      className={cn(
        "group relative flex h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-sm transition-colors xl:justify-start",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.7} />
      <span className="hidden truncate xl:block">{label}</span>
      <UnreadCount active={active} count={count} />
    </button>
  );
}

function getProviderLabel(provider: MailAccountView["provider"]) {
  if (provider === "gmail") return "Gmail";
  if (provider === "icloud") return "iCloud";
  if (provider === "hosted") return "Hosted";
  return "Microsoft 365";
}

function AccountSkeletons() {
  return (
    <div aria-label="Loading accounts" className="space-y-2 px-3 py-1">
      {[0, 1, 2].map((index) => (
        <div
          className="bg-sidebar-accent h-9 animate-pulse rounded-lg"
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
