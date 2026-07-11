import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { AgentToolName } from "@rodge-mail/agent-contract";
import { agentToolDefinitions } from "@rodge-mail/agent-contract";

import { AgentAdapterError } from "./errors.ts";

export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const MAX_AGENT_REQUEST_BYTES = 16 * 1_024;
export const MAX_AGENT_RESPONSE_BYTES = 512 * 1_024;

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface AgentHttpClientOptions {
  endpoint: URL;
  fetchImplementation?: FetchImplementation;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
  token: string;
}

export interface AgentToolCaller {
  call: (
    tool: AgentToolName,
    input: unknown,
  ) => Promise<Record<string, unknown>>;
}

const endpointErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().regex(/^[A-Z0-9_]{1,64}$/u),
        requestId: z.string().max(128).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export class AgentHttpClient implements AgentToolCaller {
  readonly #endpoint: URL;
  readonly #fetch: FetchImplementation;
  readonly #maxRequestBytes: number;
  readonly #maxResponseBytes: number;
  readonly #timeoutMs: number;
  readonly #token: string;

  constructor(options: AgentHttpClientOptions) {
    this.#endpoint = options.endpoint;
    this.#fetch = options.fetchImplementation ?? fetch;
    this.#maxRequestBytes = options.maxRequestBytes ?? MAX_AGENT_REQUEST_BYTES;
    this.#maxResponseBytes =
      options.maxResponseBytes ?? MAX_AGENT_RESPONSE_BYTES;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.#token = options.token;
  }

  async call(tool: AgentToolName, input: unknown) {
    const definition = getToolDefinition(tool);
    const argumentsValue = definition.inputSchema.parse(input);
    const requestId = randomUUID();
    const body = JSON.stringify({
      tool,
      arguments: argumentsValue,
      requestId,
    });
    if (byteLength(body) > this.#maxRequestBytes) {
      throw new AgentAdapterError("REQUEST_TOO_LARGE", { requestId });
    }
    const response = await this.#post(body, requestId);
    const responseBody = await readBoundedResponse(
      response,
      this.#maxResponseBytes,
      requestId,
    );
    if (!response.ok) throw endpointError(response, responseBody, requestId);
    if (!isJsonResponse(response)) {
      throw new AgentAdapterError("INVALID_ENDPOINT_RESPONSE", { requestId });
    }
    const parsed = parseJson(responseBody, requestId);
    const output = definition.outputSchema.safeParse(parsed);
    if (!output.success) {
      throw new AgentAdapterError("INVALID_TOOL_OUTPUT", { requestId });
    }
    return output.data;
  }

  async #post(body: string, requestId: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      return await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.#token}`,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
      });
    } catch {
      const code = controller.signal.aborted
        ? "ENDPOINT_TIMEOUT"
        : "ENDPOINT_UNAVAILABLE";
      throw new AgentAdapterError(code, { requestId });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function getToolDefinition(tool: AgentToolName) {
  if (tool === "list_accounts") return agentToolDefinitions[0];
  if (tool === "search_mail") return agentToolDefinitions[1];
  return agentToolDefinitions[2];
}

async function readBoundedResponse(
  response: Response,
  maxBytes: number,
  requestId: string,
) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AgentAdapterError("RESPONSE_TOO_LARGE", { requestId });
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = new Array<Uint8Array>();
  let totalBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new AgentAdapterError("RESPONSE_TOO_LARGE", { requestId });
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function endpointError(response: Response, body: string, requestId: string) {
  const parsed = safeParseJson(body);
  const error = endpointErrorSchema.safeParse(parsed);
  return new AgentAdapterError(
    error.success ? error.data.error.code : "ENDPOINT_ERROR",
    {
      requestId: error.success
        ? (error.data.error.requestId ?? requestId)
        : requestId,
      status: response.status,
    },
  );
}

function parseJson(value: string, requestId: string) {
  const parsed = safeParseJson(value);
  if (parsed === undefined) {
    throw new AgentAdapterError("INVALID_ENDPOINT_RESPONSE", { requestId });
  }
  return parsed;
}

// eslint-disable-next-line no-restricted-syntax -- JSON.parse is an untyped edge; callers validate the unknown value with strict schemas.
function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isJsonResponse(response: Response) {
  return /^application\/json(?:\s*;|$)/iu.test(
    response.headers.get("content-type") ?? "",
  );
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}
