import { useState } from "react";
import { Loader, Plus } from "lucide-react";

import type { AgentScope, CredentialFormValue } from "./agent-access-types";
import type { MailAccountView } from "~/features/mail/types";
import { ChoiceCard, SegmentButton } from "./agent-access-controls";
import { AGENT_SCOPES } from "./agent-access-types";

export function CredentialForm({
  accounts,
  isCreating,
  onCreate,
}: {
  accounts: MailAccountView[];
  isCreating: boolean;
  onCreate: (input: CredentialFormValue) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [scopes, setScopes] = useState<AgentScope[]>(
    AGENT_SCOPES.map((scope) => scope.value),
  );
  const [accessMode, setAccessMode] = useState<"all" | "allowlist">("all");
  const [accountIds, setAccountIds] = useState<MailAccountView["_id"][]>([]);
  const canCreate =
    label.trim().length > 0 &&
    scopes.length > 0 &&
    Number.isInteger(expiresInDays) &&
    expiresInDays >= 1 &&
    expiresInDays <= 90 &&
    (accessMode === "all" || accountIds.length > 0);

  function toggleScope(scope: AgentScope) {
    setScopes((current) =>
      current.includes(scope)
        ? current.filter((candidate) => candidate !== scope)
        : [...current, scope],
    );
  }

  function toggleAccount(accountId: MailAccountView["_id"]) {
    setAccountIds((current) =>
      current.includes(accountId)
        ? current.filter((candidate) => candidate !== accountId)
        : [...current, accountId],
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;
    void onCreate({
      accountAccess:
        accessMode === "all"
          ? { mode: "all" }
          : { mode: "allowlist", accountIds },
      expiresInDays,
      label: label.trim(),
      scopes,
    });
  }

  return (
    <form className="mail-inset rounded-[13px] border p-4" onSubmit={submit}>
      <NameField label={label} onChange={setLabel} />
      <ScopeFields scopes={scopes} toggleScope={toggleScope} />
      <AccountFields
        accessMode={accessMode}
        accountIds={accountIds}
        accounts={accounts}
        setAccessMode={setAccessMode}
        toggleAccount={toggleAccount}
      />
      <FormFooter
        canCreate={canCreate}
        expiresInDays={expiresInDays}
        isCreating={isCreating}
        setExpiresInDays={setExpiresInDays}
      />
    </form>
  );
}

function NameField({
  label,
  onChange,
}: {
  label: string;
  onChange: (label: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold">Name</span>
      <input
        autoComplete="off"
        className="mail-field mt-2 h-10 w-full rounded-[9px] border px-3 text-sm outline-none"
        maxLength={80}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Codex on this Mac"
        value={label}
      />
    </label>
  );
}

function ScopeFields({
  scopes,
  toggleScope,
}: {
  scopes: AgentScope[];
  toggleScope: (scope: AgentScope) => void;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="text-xs font-semibold">Allowed tools</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {AGENT_SCOPES.map((scope) => (
          <ChoiceCard
            checked={scopes.includes(scope.value)}
            description={scope.description}
            key={scope.value}
            label={scope.label}
            onChange={() => toggleScope(scope.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function AccountFields({
  accessMode,
  accountIds,
  accounts,
  setAccessMode,
  toggleAccount,
}: {
  accessMode: "all" | "allowlist";
  accountIds: MailAccountView["_id"][];
  accounts: MailAccountView[];
  setAccessMode: (mode: "all" | "allowlist") => void;
  toggleAccount: (accountId: MailAccountView["_id"]) => void;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="text-xs font-semibold">Mailbox access</legend>
      <div className="mail-inset mt-2 grid grid-cols-2 rounded-[10px] border p-1">
        <SegmentButton
          active={accessMode === "all"}
          label="All accounts"
          onClick={() => setAccessMode("all")}
        />
        <SegmentButton
          active={accessMode === "allowlist"}
          label="Choose accounts"
          onClick={() => setAccessMode("allowlist")}
        />
      </div>
      <AccountChoices
        accountIds={accountIds}
        accounts={accounts}
        isVisible={accessMode === "allowlist"}
        toggleAccount={toggleAccount}
      />
    </fieldset>
  );
}

function AccountChoices({
  accountIds,
  accounts,
  isVisible,
  toggleAccount,
}: {
  accountIds: MailAccountView["_id"][];
  accounts: MailAccountView[];
  isVisible: boolean;
  toggleAccount: (accountId: MailAccountView["_id"]) => void;
}) {
  if (!isVisible) return null;
  if (accounts.length === 0) {
    return (
      <p className="text-muted-foreground py-3 text-xs">
        Connect a mail account before creating a restricted key.
      </p>
    );
  }
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {accounts.map((account) => (
        <ChoiceCard
          checked={accountIds.includes(account._id)}
          description={account.address}
          key={account._id}
          label={account.label}
          onChange={() => toggleAccount(account._id)}
        />
      ))}
    </div>
  );
}

function FormFooter({
  canCreate,
  expiresInDays,
  isCreating,
  setExpiresInDays,
}: {
  canCreate: boolean;
  expiresInDays: number;
  isCreating: boolean;
  setExpiresInDays: (days: number) => void;
}) {
  return (
    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <label className="block sm:w-44">
        <span className="text-xs font-semibold">Expires after</span>
        <span className="mt-2 flex items-center gap-2">
          <input
            className="mail-field h-10 w-20 rounded-[9px] border px-3 text-sm tabular-nums outline-none"
            max={90}
            min={1}
            onChange={(event) => setExpiresInDays(Number(event.target.value))}
            type="number"
            value={expiresInDays}
          />
          <span className="text-muted-foreground text-xs">days</span>
        </span>
      </label>
      <button
        className="mail-brass-button flex h-10 items-center justify-center gap-2 rounded-[9px] px-4 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canCreate || isCreating}
        type="submit"
      >
        <CreateIcon isCreating={isCreating} />
        Create key
      </button>
    </div>
  );
}

function CreateIcon({ isCreating }: { isCreating: boolean }) {
  if (isCreating) return <Loader className="size-4 animate-spin" />;
  return <Plus className="size-4" />;
}
