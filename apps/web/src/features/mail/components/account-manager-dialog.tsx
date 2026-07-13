import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { BriefcaseBusiness, Cloud, Mail, Settings2 } from "lucide-react";

import * as Dialog from "@rodge-mail/ui-web/dialog";

import type { MailAccountView } from "../types";
import { AccountLabelForm } from "./account-label-settings";
import { AddAccountButton } from "./provider-connection-buttons";

const ACCOUNT_ICONS = {
  gmail: Mail,
  icloud: Cloud,
  microsoft: BriefcaseBusiness,
} satisfies Record<MailAccountView["provider"], LucideIcon>;

export function AccountManagerButton({
  accounts,
}: {
  accounts: MailAccountView[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog.Container onOpenChange={setIsOpen} open={isOpen}>
      <Dialog.Trigger asChild>
        <button
          aria-label="Manage mail accounts"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-[var(--mail-chassis-foreground)]/68 transition-colors hover:border-[var(--mail-brass)]/55 hover:bg-white/[0.09] hover:text-[var(--mail-chassis-foreground)]"
          title="Manage accounts"
          type="button"
        >
          <Settings2 className="size-[15px]" strokeWidth={1.8} />
        </button>
      </Dialog.Trigger>
      <Dialog.Content className="mail-dialog mail-workspace max-h-[calc(100vh-2rem)] max-w-[620px] gap-0 overflow-hidden rounded-[18px] border p-0">
        <div className="mail-chassis border-b px-6 py-5">
          <div className="flex items-start justify-between gap-8 pr-8">
            <div>
              <Dialog.Title className="font-serif text-2xl tracking-[-0.03em]">
                Mail accounts
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 max-w-md text-xs leading-5 text-[var(--mail-chassis-foreground)]/70">
                Keep connections healthy and give each inbox a name that makes
                sense at a glance.
              </Dialog.Description>
            </div>
            <AccountCount count={accounts.length} />
          </div>
        </div>

        <div className="mail-paper mail-scrollbar min-h-0 overflow-y-auto p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-4 px-1">
            <div>
              <h2 className="text-sm font-semibold">Connected inboxes</h2>
              <p className="mail-label mt-0.5 text-xs">
                Names update mailbox and sender controls.
              </p>
            </div>
            <AddAccountButton accounts={accounts} appearance="manager" />
          </div>
          <AccountCards accounts={accounts} />
        </div>
      </Dialog.Content>
    </Dialog.Container>
  );
}

function AccountCount({ count }: { count: number }) {
  return (
    <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 font-mono text-[9px] tracking-[0.08em] text-[var(--mail-chassis-foreground)]/62 uppercase sm:block">
      {count} <AccountCountLabel count={count} />
    </span>
  );
}

function AccountCountLabel({ count }: { count: number }) {
  if (count === 1) return <>account</>;
  return <>accounts</>;
}

function AccountCards({ accounts }: { accounts: MailAccountView[] }) {
  if (accounts.length === 0) {
    return (
      <div className="mail-well rounded-xl border border-dashed px-5 py-9 text-center">
        <p className="font-serif text-lg">No inboxes connected</p>
        <p className="mail-label mx-auto mt-1 max-w-xs text-xs leading-5">
          Add Gmail, iCloud, or Microsoft 365 to begin receiving mail.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {accounts.map((account) => (
        <AccountCard account={account} key={account._id} />
      ))}
    </div>
  );
}

function AccountCard({ account }: { account: MailAccountView }) {
  const Icon = ACCOUNT_ICONS[account.provider];
  const status = getAccountStatus(account);

  return (
    <article className="mail-well rounded-[14px] border px-3.5 py-3.5 shadow-[var(--warm-shadow-inset)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="mail-raised relative flex size-10 shrink-0 items-center justify-center rounded-[10px] border text-[var(--mail-ink-soft)]">
          <Icon className="size-[17px]" strokeWidth={1.7} />
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[var(--mail-paper)]"
            style={{ backgroundColor: account.accent }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{account.label}</h3>
            <span className={status.className}>{status.label}</span>
          </div>
          <p className="mail-label mt-0.5 truncate text-xs">
            {getProviderLabel(account.provider)} · {account.address}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <AccountLabelForm account={account} embedded showIdentity={false} />
      </div>
    </article>
  );
}

function getAccountStatus(account: MailAccountView) {
  if (
    account.status === "reauthorization_required" ||
    account.status === "disconnected"
  ) {
    return {
      className:
        "shrink-0 rounded-full bg-[var(--mail-highlight)]/12 px-2 py-0.5 font-mono text-[8px] tracking-[0.06em] text-[var(--mail-highlight)] uppercase",
      label: "Reconnect",
    };
  }
  if (account.status === "error" || account.lastSyncError) {
    return {
      className:
        "shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 font-mono text-[8px] tracking-[0.06em] text-red-700 uppercase dark:text-red-300",
      label: "Sync issue",
    };
  }
  return {
    className:
      "shrink-0 rounded-full bg-emerald-600/10 px-2 py-0.5 font-mono text-[8px] tracking-[0.06em] text-emerald-800 uppercase dark:text-emerald-300",
    label: "Connected",
  };
}

function getProviderLabel(provider: MailAccountView["provider"]) {
  if (provider === "gmail") return "Gmail";
  if (provider === "icloud") return "iCloud";
  return "Microsoft 365";
}
