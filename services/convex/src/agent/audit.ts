import type { AgentToolName } from "@rodge-mail/agent-contract";

export function createAuditValues(args: {
  argsHash: string;
  createdAt: number;
  credentialFingerprint: string;
  durationMs: number;
  errorCode?: string;
  outcome: "succeeded" | "denied" | "error";
  requestId: string;
  resultCount?: number;
  tool?: AgentToolName;
}) {
  return {
    argsHash: args.argsHash,
    createdAt: args.createdAt,
    credentialFingerprint: args.credentialFingerprint,
    durationMs: Math.max(0, Math.floor(args.durationMs)),
    errorCode: args.errorCode,
    outcome: args.outcome,
    requestId: args.requestId,
    resultCount: args.resultCount,
    tool: args.tool,
  };
}

export function resultCount(value: unknown) {
  if (!isRecord(value)) return undefined;
  if (Array.isArray(value.accounts)) return value.accounts.length;
  if (Array.isArray(value.messages)) return value.messages.length;
  if (isRecord(value.thread) && Array.isArray(value.thread.messages)) {
    return value.thread.messages.length;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
