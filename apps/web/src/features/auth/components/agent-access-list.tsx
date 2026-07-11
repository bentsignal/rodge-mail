import { useState } from "react";
import { KeyRound, Loader, Trash2 } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { AgentCredential, AgentScope } from "./agent-access-types";
import type { MailAccountView } from "~/features/mail/types";
import { AGENT_SCOPES } from "./agent-access-types";

export function CredentialList({
  accounts,
  credentials,
  onRevoke,
  revokingId,
}: {
  accounts: MailAccountView[];
  credentials: AgentCredential[] | undefined;
  onRevoke: (credential: AgentCredential) => Promise<void>;
  revokingId: string | undefined;
}) {
  if (!credentials) return <CredentialLoading />;
  if (credentials.length === 0) return <CredentialEmpty />;
  return (
    <div className="mt-3 space-y-2">
      {credentials.map((credential) => (
        <CredentialRow
          accounts={accounts}
          credential={credential}
          isRevoking={revokingId === credential._id}
          key={credential._id}
          onRevoke={() => void onRevoke(credential)}
        />
      ))}
    </div>
  );
}

function CredentialLoading() {
  return (
    <div className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
      <Loader className="size-3.5 animate-spin" /> Loading credentials…
    </div>
  );
}

function CredentialEmpty() {
  return (
    <div className="border-border bg-muted/40 mt-3 rounded-xl border border-dashed px-4 py-5 text-center">
      <KeyRound className="text-muted-foreground mx-auto size-4" />
      <p className="text-muted-foreground mt-2 text-xs">
        No agent credentials yet.
      </p>
    </div>
  );
}

function CredentialRow({
  accounts,
  credential,
  isRevoking,
  onRevoke,
}: {
  accounts: MailAccountView[];
  credential: AgentCredential;
  isRevoking: boolean;
  onRevoke: () => void;
}) {
  const accountCoverage = getAccountCoverage(credential, accounts);
  const [openedAt] = useState(Date.now);
  const status = getCredentialStatus(credential, openedAt);
  return (
    <article className="border-border bg-background/45 flex items-start gap-3 rounded-xl border p-3">
      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <KeyRound className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <CredentialName credential={credential} status={status} />
        <p className="text-muted-foreground mt-1 text-[10px] leading-4">
          {credential.scopes.map(getScopeLabel).join(" · ")}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[10px] leading-4">
          {accountCoverage} · Expires {formatDate(credential.expiresAt)} ·
          {` ${getLastUsedLabel(credential.lastUsedAt)}`}
        </p>
      </div>
      <RevokeButton
        credential={credential}
        isUnavailable={status !== "active"}
        isRevoking={isRevoking}
        onRevoke={onRevoke}
      />
    </article>
  );
}

function CredentialName({
  credential,
  status,
}: {
  credential: AgentCredential;
  status: CredentialStatus;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <h4 className="truncate text-xs font-semibold">{credential.label}</h4>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 font-mono text-[8px] tracking-[0.08em] uppercase",
          status === "revoked"
            ? "bg-destructive/10 text-destructive"
            : status === "expired"
              ? "bg-muted text-muted-foreground"
              : "text-foreground bg-[var(--mail-selected)]",
        )}
      >
        {status}
      </span>
    </div>
  );
}

function RevokeButton({
  credential,
  isUnavailable,
  isRevoking,
  onRevoke,
}: {
  credential: AgentCredential;
  isUnavailable: boolean;
  isRevoking: boolean;
  onRevoke: () => void;
}) {
  if (isUnavailable) return null;
  return (
    <button
      aria-label={`Revoke ${credential.label}`}
      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50"
      disabled={isRevoking}
      onClick={onRevoke}
      title="Revoke credential"
      type="button"
    >
      <RevokeIcon isRevoking={isRevoking} />
    </button>
  );
}

type CredentialStatus = "active" | "expired" | "revoked";

function getCredentialStatus(credential: AgentCredential, currentTime: number) {
  if (credential.revokedAt !== undefined) return "revoked";
  if (credential.expiresAt <= currentTime) return "expired";
  return "active";
}

function RevokeIcon({ isRevoking }: { isRevoking: boolean }) {
  if (isRevoking) return <Loader className="size-3.5 animate-spin" />;
  return <Trash2 className="size-3.5" />;
}

function getAccountCoverage(
  credential: AgentCredential,
  accounts: MailAccountView[],
) {
  if (credential.accountAccess.mode === "all") return "All accounts";
  return credential.accountAccess.accountIds
    .map(
      (accountId) =>
        accounts.find((account) => account._id === accountId)?.label ??
        "Disconnected account",
    )
    .join(", ");
}

function getScopeLabel(scope: AgentScope) {
  return (
    AGENT_SCOPES.find((candidate) => candidate.value === scope)?.label ?? scope
  );
}

function getLastUsedLabel(timestamp: number | undefined) {
  if (!timestamp) return "Never used";
  return `Last used ${formatDateTime(timestamp)}`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(timestamp);
}
