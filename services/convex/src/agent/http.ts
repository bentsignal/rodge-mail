/* eslint-disable complexity, max-lines, max-lines-per-function, no-restricted-syntax, @typescript-eslint/no-unsafe-argument -- This external bearer boundary keeps every validation, audit, and generic-error branch explicit. */
import { makeFunctionReference } from "convex/server";
import { z } from "zod";

import type {
  AgentAccountAccess,
  AgentToolName,
  GetThreadOutput,
  ListAccountsOutput,
  SearchMailOutput,
} from "@rodge-mail/agent-contract";
import { agentToolDefinitions } from "@rodge-mail/agent-contract";

import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { httpAction } from "../_generated/server";
import { rateLimiter } from "../limiter";
import { createAuditValues, resultCount } from "./audit";
import {
  credentialIsActive,
  hasRequiredScope,
  resolveAgentTool,
} from "./policy";
import {
  credentialFingerprint,
  hashAgentArguments,
  hashAgentToken,
  isAgentToken,
} from "./token";

const MAX_REQUEST_BYTES = 16 * 1_024;
const MAX_RESPONSE_BYTES = 512 * 1_024;

interface CredentialLookupArgs extends Record<string, unknown> {
  tokenHash: string;
}

interface AuditArgs extends Record<string, unknown> {
  ownerId?: string;
  credentialId?: Id<"agentCredentials">;
  credentialFingerprint: string;
  tool?: AgentToolName;
  requestId: string;
  argsHash: string;
  outcome: "succeeded" | "denied" | "error";
  resultCount?: number;
  durationMs: number;
  errorCode?: string;
  createdAt: number;
}

interface ToolContextArgs extends Record<string, unknown> {
  ownerId: string;
  accountAccess: AgentAccountAccess;
}

interface SearchArgs extends ToolContextArgs {
  credentialId: Id<"agentCredentials">;
  accountId?: string;
  query: string;
  limit: number;
  cursor?: string;
}

const FIND_CREDENTIAL = makeFunctionReference<
  "query",
  CredentialLookupArgs,
  Doc<"agentCredentials"> | null
>("agent/internal:findCredentialByHash");
const RECORD_AUDIT = makeFunctionReference<"mutation", AuditArgs, unknown>(
  "agent/internal:recordAudit",
);
const LIST_ACCOUNTS = makeFunctionReference<
  "query",
  ToolContextArgs,
  ListAccountsOutput
>("agent/queries:listAccounts");
const GET_THREAD = makeFunctionReference<
  "query",
  ToolContextArgs & { threadId: string },
  GetThreadOutput | null
>("agent/queries:getThread");
const SEARCH_MAIL = makeFunctionReference<
  "action",
  SearchArgs,
  SearchMailOutput | null
>("agent/search:searchMail");

const requestEnvelopeSchema = z
  .object({
    tool: z.string().min(1).max(64),
    arguments: z.unknown(),
    requestId: z.string().min(1).max(128),
  })
  .strict();

export class AgentHttpError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "AgentHttpError";
    this.code = code;
    this.status = status;
  }
}

export const tools = httpAction(async (ctx, request) => {
  const startedAt = Date.now();
  const requestId = createRequestId();
  let argsHash = await hashAgentArguments("");
  let fingerprint = "unauthenticated";
  let credential: Doc<"agentCredentials"> | null = null;
  let tool: AgentToolName | undefined;
  let outcome: AuditArgs["outcome"] = "error";
  let safeErrorCode: string | undefined;
  let count: number | undefined;
  let auditRecorded = false;
  try {
    assertJsonRequest(request);
    const body = await readBoundedBody(request, MAX_REQUEST_BYTES);
    argsHash = await hashAgentArguments(body);
    const token = parseBearer(request.headers.get("authorization"));
    const tokenHash = await hashAgentToken(token);
    argsHash = await hashAgentArguments(
      `${tokenHash}:${await hashAgentArguments(body)}`,
    );
    fingerprint = credentialFingerprint(tokenHash);
    credential = await ctx.runQuery(FIND_CREDENTIAL, { tokenHash });
    if (!credential || !credentialIsActive(credential, Date.now())) {
      throw new AgentHttpError("INVALID_CREDENTIAL", 401);
    }
    const limited = await rateLimiter.limit(ctx, "agentRead", {
      key: `${credential.ownerId}:${credential._id}`,
    });
    if (!limited.ok) throw new AgentHttpError("RATE_LIMITED", 429);
    const envelope = parseEnvelope(body);
    tool = resolveAgentTool(envelope.tool);
    if (!tool) throw new AgentHttpError("INVALID_TOOL", 400);
    const definition = toolDefinition(tool);
    const parsedArguments = definition.inputSchema.safeParse(
      envelope.arguments,
    );
    if (!parsedArguments.success) {
      throw new AgentHttpError("INVALID_REQUEST", 400);
    }
    argsHash = await hashAgentArguments(
      `${tokenHash}:${JSON.stringify(parsedArguments.data)}`,
    );
    if (!hasRequiredScope(credential.scopes, tool)) {
      throw new AgentHttpError("INSUFFICIENT_SCOPE", 403);
    }
    const result = await dispatchTool(
      ctx,
      credential,
      tool,
      parsedArguments.data,
    );
    if (result === null) {
      throw new AgentHttpError("MAIL_RESOURCE_NOT_FOUND", 404);
    }
    const output = definition.outputSchema.safeParse(result);
    if (!output.success) throw new AgentHttpError("INTERNAL_ERROR", 500);
    count = resultCount(output.data);
    outcome = "succeeded";
    await ctx.runMutation(RECORD_AUDIT, {
      ...createAuditValues({
        argsHash,
        createdAt: Date.now(),
        credentialFingerprint: fingerprint,
        durationMs: Date.now() - startedAt,
        outcome,
        requestId,
        resultCount: count,
        tool,
      }),
      ownerId: credential.ownerId,
      credentialId: credential._id,
    });
    auditRecorded = true;
    return jsonResponse(output.data, 200, requestId);
  } catch (error) {
    const safe = safeHttpError(error);
    safeErrorCode = safe.code;
    outcome = safe.status >= 500 ? "error" : "denied";
    return jsonResponse(
      { error: { code: safe.code, requestId } },
      safe.status,
      requestId,
    );
  } finally {
    if (credential && !auditRecorded) {
      await safeAudit(ctx, {
        ...createAuditValues({
          argsHash,
          createdAt: Date.now(),
          credentialFingerprint: fingerprint,
          durationMs: Date.now() - startedAt,
          errorCode: safeErrorCode,
          outcome,
          requestId,
          resultCount: count,
          tool,
        }),
        ownerId: credential.ownerId,
        credentialId: credential._id,
      });
    }
  }
});

async function dispatchTool(
  ctx: ActionCtx,
  credential: Doc<"agentCredentials">,
  tool: AgentToolName,
  args: unknown,
) {
  const context = {
    ownerId: credential.ownerId,
    accountAccess: credential.accountAccess,
  };
  if (tool === "list_accounts") {
    return await ctx.runQuery(LIST_ACCOUNTS, context);
  }
  if (tool === "get_thread") {
    const parsed = agentToolDefinitions[2].inputSchema.parse(args);
    return await ctx.runQuery(GET_THREAD, { ...context, ...parsed });
  }
  const parsed = agentToolDefinitions[1].inputSchema.parse(args);
  return await ctx.runAction(SEARCH_MAIL, {
    ...context,
    credentialId: credential._id,
    accountId: parsed.accountId,
    query: parsed.query,
    limit: parsed.limit ?? 16,
    cursor: parsed.cursor,
  });
}

export async function readBoundedBody(request: Request, maxBytes: number) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = new Array<Uint8Array>();
  let total = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AgentHttpError("REQUEST_TOO_LARGE", 413);
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function parseBearer(value: string | null) {
  const match = /^Bearer ([^\s,]+)$/iu.exec(value ?? "");
  const token = match?.[1];
  if (!token || !isAgentToken(token)) {
    throw new AgentHttpError("INVALID_CREDENTIAL", 401);
  }
  return token;
}

function parseEnvelope(bytes: Uint8Array) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AgentHttpError("INVALID_REQUEST", 400);
  }
  const envelope = requestEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) throw new AgentHttpError("INVALID_REQUEST", 400);
  return envelope.data;
}

function assertJsonRequest(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/iu.test(type)) {
    throw new AgentHttpError("UNSUPPORTED_MEDIA_TYPE", 415);
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw new AgentHttpError("REQUEST_TOO_LARGE", 413);
  }
}

function toolDefinition(tool: AgentToolName) {
  if (tool === "list_accounts") return agentToolDefinitions[0];
  if (tool === "search_mail") return agentToolDefinitions[1];
  return agentToolDefinitions[2];
}

function safeHttpError(error: unknown) {
  return error instanceof AgentHttpError
    ? error
    : new AgentHttpError("INTERNAL_ERROR", 500);
}

function jsonResponse(value: unknown, status: number, requestId: string) {
  const body = JSON.stringify(value);
  if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
    if (status >= 400) {
      return new Response(
        JSON.stringify({ error: { code: "INTERNAL_ERROR", requestId } }),
        responseInit(500),
      );
    }
    throw new AgentHttpError("INTERNAL_ERROR", 500);
  }
  return new Response(body, responseInit(status));
}

function responseInit(status: number) {
  return {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  };
}

function createRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let value = "";
  for (const byte of bytes) value += byte.toString(16).padStart(2, "0");
  return value;
}

async function safeAudit(ctx: ActionCtx, args: AuditArgs) {
  try {
    await ctx.runMutation(RECORD_AUDIT, args);
  } catch {
    // Audit is best-effort so a telemetry outage cannot expose or duplicate mail.
  }
}
