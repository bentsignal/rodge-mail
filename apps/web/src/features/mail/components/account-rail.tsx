import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { useAction } from "convex/react";
import {
  BriefcaseBusiness,
  Cloud,
  Inbox,
  Link,
  Loader,
  Mail,
  PenLine,
} from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import { cn } from "@rodge-mail/std/cn";
import { toast } from "@rodge-mail/ui-web/toast";

import type { MailAccountView } from "../types";
import { PasskeyManagementButton } from "~/features/auth/components/passkey-management-button";
import { SignOutLink } from "~/features/auth/components/sign-out-link";
import { ThemeToggle } from "~/features/theme/components/theme-toggle";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";

const ACCOUNT_ICONS = {
  gmail: Mail,
  icloud: Cloud,
  microsoft: BriefcaseBusiness,
} satisfies Record<MailAccountView["provider"], LucideIcon>;

export function AccountRail() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const openComposer = useMailStore((store) => store.openComposer);
  const { accounts, isLoadingAccounts, unreadCounts } = useLiveMail();

  return (
    <aside className="relative z-10 hidden h-full w-[82px] shrink-0 flex-col px-2.5 py-4 md:flex xl:w-[244px] xl:px-4">
      <Brand />
      <button
        className="group mt-8 flex h-11 items-center justify-center gap-2.5 rounded-xl bg-[#20251f] px-3 text-sm font-semibold text-[#f7f1e6] shadow-[0_8px_24px_rgba(32,37,31,0.16)] transition hover:-translate-y-0.5 hover:bg-[#2c332b] xl:justify-start xl:px-4"
        onClick={openComposer}
        type="button"
      >
        <PenLine className="size-[17px] transition-transform group-hover:-rotate-3" />
        <span className="hidden xl:inline">Compose</span>
        <kbd className="ml-auto hidden rounded border border-white/15 px-1.5 py-0.5 font-mono text-[9px] font-normal text-white/55 xl:block">
          C
        </kbd>
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
        <ProviderConnectionButtons accounts={accounts} />
      </nav>

      <div className="mt-auto space-y-1.5">
        <div className="hidden px-3 pb-3 xl:block">
          <p className="font-mono text-[9px] tracking-[0.18em] text-[#897d6f] uppercase">
            All systems quiet
          </p>
          <p className="mt-1 text-xs text-[#6e665d] dark:text-[#a89f94]">
            {getSyncLabel(accounts)}
          </p>
        </div>
        <div className="border-border/80 mx-3 mb-3 border-t" />
        <PasskeyManagementButton />
        <div className="flex justify-center xl:justify-start xl:px-2">
          <ThemeToggle />
        </div>
        <div className="hidden px-1 xl:block">
          <SignOutLink />
        </div>
      </div>
    </aside>
  );
}

function ProviderConnectionButtons({
  accounts,
}: {
  accounts: MailAccountView[];
}) {
  const connectGmail = useAction(api.accounts.actions.connectGmail);
  const connectMicrosoft = useAction(api.accounts.actions.connectMicrosoft);
  const [connectingProvider, setConnectingProvider] = useState<
    "gmail" | "microsoft" | undefined
  >();
  const gmailAccount = accounts.find((account) => account.provider === "gmail");
  const microsoftAccount = accounts.find(
    (account) => account.provider === "microsoft",
  );

  async function connect(
    provider: "gmail" | "microsoft",
    startAuthorization: () => Promise<{ authorizationUrl: string }>,
  ) {
    setConnectingProvider(provider);
    try {
      const result = await startAuthorization();
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast.error(getConnectionError(error, provider));
      setConnectingProvider(undefined);
    }
  }

  return (
    <>
      <ProviderConnectionButton
        account={gmailAccount}
        isConnecting={connectingProvider === "gmail"}
        label="Gmail"
        onConnect={() =>
          void connect("gmail", () => connectGmail({ returnPath: "/" }))
        }
      />
      <ProviderConnectionButton
        account={microsoftAccount}
        isConnecting={connectingProvider === "microsoft"}
        label="Microsoft 365"
        onConnect={() =>
          void connect("microsoft", () => connectMicrosoft({ returnPath: "/" }))
        }
      />
    </>
  );
}

function ProviderConnectionButton({
  account,
  isConnecting,
  label,
  onConnect,
}: {
  account: MailAccountView | undefined;
  isConnecting: boolean;
  label: string;
  onConnect: () => void;
}) {
  if (account && account.status !== "reauthorization_required") return null;
  const connectionLabel = `${account ? "Reconnect" : "Connect"} ${label}`;

  return (
    <button
      aria-label={connectionLabel}
      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#b9ad9d] px-3 text-xs font-semibold text-[#756b60] transition hover:border-[#c76749] hover:text-[#a74f37] disabled:opacity-50 xl:justify-start dark:border-[#555a52] dark:text-[#aaa195]"
      disabled={isConnecting}
      onClick={onConnect}
      title={connectionLabel}
      type="button"
    >
      <ConnectionIcon isConnecting={isConnecting} />
      <span className="hidden xl:inline">{connectionLabel}</span>
    </button>
  );
}

function ConnectionIcon({ isConnecting }: { isConnecting: boolean }) {
  if (isConnecting) return <Loader className="size-3.5 animate-spin" />;
  return <Link className="size-3.5" />;
}

function getConnectionError(error: unknown, provider: "gmail" | "microsoft") {
  if (error instanceof Error && error.message.trim()) return error.message;
  return `Could not start ${provider === "gmail" ? "Gmail" : "Microsoft"} authorization.`;
}

function Brand() {
  return (
    <div className="flex items-center justify-center gap-3 xl:justify-start xl:px-2">
      <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-[#20251f] text-[#f7f1e6] shadow-sm">
        <span className="font-serif text-xl italic">R</span>
        <span className="absolute right-1.5 bottom-1.5 size-1 rounded-full bg-[#d77a55]" />
      </div>
      <div className="hidden min-w-0 xl:block">
        <p className="font-serif text-[17px] leading-5 font-semibold tracking-[-0.02em]">
          Rodge Mail
        </p>
        <p className="font-mono text-[8px] tracking-[0.18em] text-[#897d6f] uppercase">
          Personal dispatch
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 w-full items-center justify-center gap-3 rounded-xl px-3 text-sm transition xl:justify-start",
        active
          ? "bg-[#e8e0d2] text-[#20251f] shadow-[inset_0_0_0_1px_rgba(82,67,48,0.06)] dark:bg-[#343832] dark:text-[#f8f1e6]"
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
        active ? "bg-[#20251f] text-white" : "bg-black/[0.055]",
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

function getSyncLabel(accounts: MailAccountView[]) {
  if (accounts.length === 0) return "Waiting for an account";
  if (accounts.some((account) => account.status === "syncing")) {
    return "Syncing mail…";
  }
  if (accounts.some((account) => account.status === "error")) {
    return "One account needs attention";
  }
  const latestSync = Math.max(
    ...accounts.map((account) => account.lastSyncedAt ?? 0),
  );
  if (latestSync === 0) return "Waiting for first sync";
  return `Last sync ${new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  }).format(Math.round((latestSync - Date.now()) / 60_000), "minute")}`;
}
