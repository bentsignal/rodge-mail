import type { FunctionReturnType } from "convex/server";

import type { api } from "@rodge-mail/convex/api";

import type { MailAccountView } from "~/features/mail/types";

export type AgentScope = "accounts:read" | "mail:search" | "threads:read";

export type AgentCredential = FunctionReturnType<
  typeof api.agent.credentials.list
>[number];

export interface CredentialFormValue {
  accountAccess:
    | { mode: "all" }
    | { mode: "allowlist"; accountIds: MailAccountView["_id"][] };
  expiresInDays: number;
  label: string;
  scopes: AgentScope[];
}

export const AGENT_SCOPES = [
  {
    description: "See the connected mailboxes available to the agent.",
    label: "List accounts",
    value: "accounts:read",
  },
  {
    description: "Search redacted mail results, including semantic search.",
    label: "Search mail",
    value: "mail:search",
  },
  {
    description: "Read the messages in a selected conversation.",
    label: "Read threads",
    value: "threads:read",
  },
] as const satisfies readonly {
  description: string;
  label: string;
  value: AgentScope;
}[];
