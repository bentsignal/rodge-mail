import type {
  AgentAccountAccess,
  AgentScope,
  AgentToolName,
} from "@rodge-mail/agent-contract";

export const AGENT_TOKEN_DEFAULT_DAYS = 30;
export const AGENT_TOKEN_MAX_DAYS = 90;

const TOOL_SCOPE = {
  list_accounts: "accounts:read",
  search_mail: "mail:search",
  get_thread: "threads:read",
} as const satisfies Record<AgentToolName, AgentScope>;

export function requiredScope(tool: AgentToolName) {
  return TOOL_SCOPE[tool];
}

export function hasRequiredScope(scopes: AgentScope[], tool: AgentToolName) {
  return scopes.includes(requiredScope(tool));
}

export function accountIsAllowed(
  access: AgentAccountAccess,
  accountId: string,
) {
  return access.mode === "all" || access.accountIds.includes(accountId);
}

export function filterAllowedAccountIds(
  access: AgentAccountAccess,
  ownedAccountIds: string[],
) {
  if (access.mode === "all") return ownedAccountIds;
  const owned = new Set(ownedAccountIds);
  return access.accountIds.filter((accountId) => owned.has(accountId));
}

export function credentialIsActive(
  credential: { expiresAt: number; revokedAt?: number },
  now: number,
) {
  return credential.revokedAt === undefined && credential.expiresAt > now;
}

export function validateCredentialLifetime(days: number | undefined) {
  const effective = days ?? AGENT_TOKEN_DEFAULT_DAYS;
  if (
    !Number.isInteger(effective) ||
    effective < 1 ||
    effective > AGENT_TOKEN_MAX_DAYS
  ) {
    throw new Error("Credential lifetime must be between 1 and 90 days");
  }
  return effective;
}

export function allUnique(values: string[]) {
  return new Set(values).size === values.length;
}

export function resolveAgentTool(value: string) {
  if (value === "list_accounts") return value;
  if (value === "search_mail") return value;
  if (value === "get_thread") return value;
  return undefined;
}
