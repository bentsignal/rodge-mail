import type { LucideIcon } from "lucide-react";
import { BriefcaseBusiness, Cloud, Inbox, Mail, PenLine } from "lucide-react";

import type { MailAccount } from "@rodge-mail/features/mail";
import { cn } from "@rodge-mail/std/cn";

import { PasskeyManagementButton } from "~/features/auth/components/passkey-management-button";
import { SignOutLink } from "~/features/auth/components/sign-out-link";
import { ThemeToggle } from "~/features/theme/components/theme-toggle";
import { useMailStore } from "../store";

const ACCOUNT_ICONS = {
  gmail: Mail,
  icloud: Cloud,
  microsoft: BriefcaseBusiness,
} satisfies Record<MailAccount["provider"], LucideIcon>;

export function AccountRail() {
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const unreadCounts = useMailStore((store) => store.unreadCounts);
  const openComposer = useMailStore((store) => store.openComposer);

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
          count={unreadCounts.all ?? 0}
          icon={Inbox}
          label="Unified inbox"
          onClick={() => setAccountFilter("all")}
        />
        <div className="border-border/80 mx-3 my-3 border-t" />
        {accounts.map((account) => {
          const Icon = ACCOUNT_ICONS[account.provider];
          return (
            <AccountButton
              active={accountFilter === account.id}
              accent={account.accent}
              count={unreadCounts[account.id] ?? 0}
              icon={Icon}
              key={account.id}
              label={account.label}
              onClick={() => setAccountFilter(account.id)}
            />
          );
        })}
      </nav>

      <div className="mt-auto space-y-1.5">
        <div className="hidden px-3 pb-3 xl:block">
          <p className="font-mono text-[9px] tracking-[0.18em] text-[#897d6f] uppercase">
            All systems quiet
          </p>
          <p className="mt-1 text-xs text-[#6e665d] dark:text-[#a89f94]">
            Last sync 2m ago
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
  count: number;
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

function UnreadCount({ active, count }: { active: boolean; count: number }) {
  if (count === 0) return null;

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
