/* eslint-disable @typescript-eslint/consistent-type-assertions -- Select values are validated against the loaded owner-scoped account list before sending. */
import { ChevronDown } from "lucide-react";

import type { Id } from "@rodge-mail/convex/model";

import type { MailAccountView } from "../types";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";

export function ComposeAccountField() {
  const { accounts } = useLiveMail();
  const composerAccountId = useMailStore((store) => store.composerAccountId);
  const setComposerAccountId = useMailStore(
    (store) => store.setComposerAccountId,
  );
  const sendableAccounts = accounts.filter(canSendFromAccount);
  const selectedAccount = getSendingAccount(
    sendableAccounts,
    composerAccountId,
  );

  return (
    <label className="flex min-h-12 items-center gap-4 border-b border-[var(--mail-seam)]">
      <span className="mail-label w-12 shrink-0 font-mono text-[9px] tracking-[0.14em] uppercase">
        From
      </span>
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: selectedAccount?.accent ?? "#aaa095" }}
      />
      <span className="relative min-w-0 flex-1">
        <select
          aria-label="From account"
          className="h-12 w-full appearance-none bg-transparent pr-7 text-sm outline-none disabled:text-[var(--mail-ink-soft)]"
          disabled={sendableAccounts.length === 0}
          onChange={(event) =>
            setComposerAccountId(toMailAccountId(event.target.value))
          }
          value={selectedAccount?._id ?? ""}
        >
          <AccountOptions accounts={sendableAccounts} />
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-0 size-3.5 -translate-y-1/2 text-[var(--mail-ink-soft)]"
        />
      </span>
    </label>
  );
}

function AccountOptions({ accounts }: { accounts: MailAccountView[] }) {
  if (accounts.length === 0) {
    return <option value="">No connected accounts</option>;
  }
  return accounts.map((account) => (
    <option key={account._id} value={account._id}>
      {providerLabel(account.provider)} · {account.address}
    </option>
  ));
}

export function getSendingAccount(
  accounts: MailAccountView[],
  selectedAccountId: MailAccountView["_id"] | undefined,
) {
  const selected = accounts.find(
    (account) =>
      account._id === selectedAccountId && canSendFromAccount(account),
  );
  return selected ?? accounts.find(canSendFromAccount);
}

function canSendFromAccount(account: MailAccountView) {
  return (
    ["gmail", "microsoft", "icloud"].includes(account.provider) &&
    (account.status === "connected" || account.status === "syncing")
  );
}

function providerLabel(provider: MailAccountView["provider"]) {
  if (provider === "gmail") return "Gmail";
  if (provider === "icloud") return "iCloud";
  return "Microsoft 365";
}

function toMailAccountId(value: string) {
  return value as Id<"mailAccounts">;
}
