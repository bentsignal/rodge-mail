import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import {
  AtSign,
  BriefcaseBusiness,
  Cloud,
  Mail,
  Settings2,
} from "lucide-react";

import * as Dialog from "@rodge-mail/ui-web/dialog";

import type { MailAccountView } from "../types";
import { AccountLabelForm } from "./account-label-settings";
import { AddAccountButton } from "./provider-connection-buttons";
import { RemoveAccountButton } from "./remove-account-dialog";

const ACCOUNT_ICONS = {
  gmail: Mail,
  hosted: AtSign,
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
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent transition-colors"
          title="Manage accounts"
          type="button"
        >
          <Settings2 className="size-[15px]" strokeWidth={1.8} />
        </button>
      </Dialog.Trigger>
      <Dialog.Content className="mail-dialog bg-background max-h-[calc(100vh-2rem)] max-w-[620px] gap-0 overflow-hidden rounded-[18px] border p-0">
        <div className="border-b px-6 py-5">
          <div className="flex items-start justify-between gap-8 pr-8">
            <div>
              <Dialog.Title className="text-2xl font-semibold tracking-tight">
                Mail accounts
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground mt-1.5 max-w-md text-xs leading-5">
                Keep connections healthy and give each inbox a name that makes
                sense at a glance.
              </Dialog.Description>
            </div>
            <AccountCount count={accounts.length} />
          </div>
        </div>

        <div className="bg-background mail-scrollbar min-h-0 overflow-y-auto p-4 sm:p-5">
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
    <span className="border-border bg-muted text-muted-foreground hidden shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase sm:block">
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
      <div className="bg-muted rounded-xl border border-dashed px-5 py-9 text-center">
        <p className="text-lg">No inboxes connected</p>
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
    <article className="rounded-[14px] border px-3.5 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="bg-background text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-[10px] border">
          <Icon className="size-[17px]" strokeWidth={1.7} />
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
        <RemoveAccountButton
          account={account}
          providerLabel={getProviderLabel(account.provider)}
        />
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
        "shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-destructive uppercase",
      label: "Reconnect",
    };
  }
  if (account.status === "error" || account.lastSyncError) {
    return {
      className:
        "shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-destructive uppercase",
      label: "Sync issue",
    };
  }
  return {
    className:
      "shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase",
    label: "Connected",
  };
}

function getProviderLabel(provider: MailAccountView["provider"]) {
  if (provider === "gmail") return "Gmail";
  if (provider === "icloud") return "iCloud";
  if (provider === "hosted") return "Hosted";
  return "Microsoft 365";
}
