import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import { toast } from "@rodge-mail/ui-web/toast";

import type { MailAccountView } from "../types";
import { useLiveMail } from "../live-data";

const MAX_LABEL_LENGTH = 80;
type SaveStatus = "idle" | "saving" | "success" | "error";

export function AccountLabelSettings() {
  const { accounts } = useLiveMail();

  return (
    <section>
      <h2 className="text-sm font-semibold">Mail account names</h2>
      <p className="mail-label mt-1 text-xs leading-5">
        Choose the names shown in mailboxes and sender controls. Account
        addresses remain visible so similar accounts are easy to tell apart.
      </p>
      <AccountLabelForms accounts={accounts} />
    </section>
  );
}

function AccountLabelForms({ accounts }: { accounts: MailAccountView[] }) {
  if (accounts.length === 0) {
    return (
      <p className="mail-label mt-4 text-xs">Connect an account to name it.</p>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {accounts.map((account) => (
        <AccountLabelForm account={account} key={account._id} />
      ))}
    </div>
  );
}

function AccountLabelForm({ account }: { account: MailAccountView }) {
  const setDisplayLabel = useMutation(api.accounts.mutations.setDisplayLabel);
  const [label, setLabel] = useState(account.displayLabel ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const identity = account.displayName?.trim();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    clearTimeout(resetTimer.current);
    setSaveStatus("saving");
    try {
      await setDisplayLabel({ accountId: account._id, displayLabel: label });
      setSaveStatus("success");
    } catch {
      toast.error("Could not save this account name.");
      setSaveStatus("error");
    }
    resetTimer.current = setTimeout(() => setSaveStatus("idle"), 1800);
  }

  return (
    <form
      className="mail-well rounded-xl border p-3"
      onSubmit={(event) => void save(event)}
    >
      <label
        className="mail-label text-[10px] font-semibold tracking-[0.08em] uppercase"
        htmlFor={`account-label-${account._id}`}
      >
        Display name
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          autoComplete="off"
          className="mail-field h-9 min-w-0 flex-1 rounded-lg border border-[var(--mail-border-strong)] px-3 text-sm outline-none focus:border-[var(--mail-brass)]"
          id={`account-label-${account._id}`}
          maxLength={MAX_LABEL_LENGTH}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={identity ?? account.address}
          value={label}
        />
        <button
          aria-live="polite"
          aria-label={getSaveStatusLabel(saveStatus)}
          className="mail-raised flex h-9 w-[4.5rem] items-center justify-center rounded-lg border px-3 text-xs font-semibold disabled:opacity-70"
          disabled={saveStatus === "saving"}
          type="submit"
        >
          <SaveButtonContent status={saveStatus} />
        </button>
      </div>
      <p className="mail-label mt-2 truncate text-xs">
        {getAccountIdentity(account.provider, identity, account.address)}
      </p>
    </form>
  );
}

function SaveButtonContent({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return <LoaderCircle aria-hidden className="size-4 animate-spin" />;
  }
  if (status === "success") return <Check aria-hidden className="size-4" />;
  if (status === "error") {
    return <TriangleAlert aria-hidden className="size-4" />;
  }
  return <>Save</>;
}

function getSaveStatusLabel(status: SaveStatus) {
  if (status === "saving") return "Saving account name";
  if (status === "success") return "Account name saved";
  if (status === "error") return "Account name could not be saved";
  return "Save account name";
}

function getAccountIdentity(
  provider: MailAccountView["provider"],
  identity: string | undefined,
  address: string,
) {
  const providerLabel =
    provider === "gmail"
      ? "Gmail"
      : provider === "icloud"
        ? "iCloud"
        : "Microsoft 365";
  if (identity && identity !== address) {
    return `${providerLabel} · ${identity} · ${address}`;
  }
  return `${providerLabel} · ${address}`;
}
