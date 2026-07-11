import { useState } from "react";
// eslint-disable-next-line no-restricted-imports -- Settings opens on demand and needs a live credential list, so route preloading would fetch private controls for every mailbox visit.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction, useMutation } from "convex/react";
import { Bot } from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import { toast } from "@rodge-mail/ui-web/toast";

import type {
  AgentCredential,
  CredentialFormValue,
} from "./agent-access-types";
import { useLiveMail } from "~/features/mail/live-data";
import { CredentialForm } from "./agent-access-form";
import { CredentialList } from "./agent-access-list";
import { IssuedToken } from "./agent-access-token";

export function AgentAccessSettings() {
  const { accounts } = useLiveMail();
  const credentialsQuery = useQuery({
    ...convexQuery(api.agent.credentials.list, {}),
    select: (credentials) => credentials,
  });
  const createCredential = useAction(api.agent.credentials.create);
  const revokeCredential = useMutation(api.agent.credentials.revoke);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string>();
  const [issuedToken, setIssuedToken] = useState<{
    label: string;
    token: string;
  }>();

  async function create(input: CredentialFormValue) {
    setIsCreating(true);
    try {
      const result = await createCredential(input);
      setIssuedToken({ label: result.label, token: result.token });
      setIsCreating(false);
      toast.success("Agent credential created.");
    } catch (error) {
      setIsCreating(false);
      toast.error(getErrorMessage(error, "Could not create the credential."));
    }
  }

  async function revoke(credential: AgentCredential) {
    setRevokingId(credential._id);
    try {
      await revokeCredential({ credentialId: credential._id });
      setRevokingId(undefined);
      toast.success(`${credential.label} revoked.`);
    } catch (error) {
      setRevokingId(undefined);
      toast.error(getErrorMessage(error, "Could not revoke the credential."));
    }
  }

  return (
    <section aria-labelledby="agent-access-heading">
      <AgentAccessHeading />
      <div className="mt-5">
        <CredentialCreator
          accounts={accounts}
          isCreating={isCreating}
          issuedToken={issuedToken}
          onCreate={create}
          onDone={() => setIssuedToken(undefined)}
        />
      </div>
      <div className="border-border mt-6 border-t pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-xs font-semibold">Issued credentials</h3>
          <span className="text-muted-foreground font-mono text-[9px] tracking-[0.08em] uppercase">
            {credentialsQuery.data?.length ?? 0} total
          </span>
        </div>
        <CredentialList
          accounts={accounts}
          credentials={credentialsQuery.data}
          onRevoke={revoke}
          revokingId={revokingId}
        />
      </div>
    </section>
  );
}

function AgentAccessHeading() {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Bot className="size-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold" id="agent-access-heading">
          Agent access
        </h2>
        <p className="text-muted-foreground mt-1 max-w-lg text-xs leading-5">
          Issue a time-limited key for read-only mail tools. Keys cannot send,
          delete, or change mail.
        </p>
      </div>
    </div>
  );
}

function CredentialCreator({
  accounts,
  isCreating,
  issuedToken,
  onCreate,
  onDone,
}: {
  accounts: ReturnType<typeof useLiveMail>["accounts"];
  isCreating: boolean;
  issuedToken: { label: string; token: string } | undefined;
  onCreate: (input: CredentialFormValue) => Promise<void>;
  onDone: () => void;
}) {
  if (issuedToken) {
    return <IssuedToken issuedToken={issuedToken} onDone={onDone} />;
  }
  return (
    <CredentialForm
      accounts={accounts}
      isCreating={isCreating}
      onCreate={onCreate}
    />
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
