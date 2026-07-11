import { describe, expect, it, vi } from "vitest";

import { UNTRUSTED_MAIL_NOTICE } from "@rodge-mail/agent-contract";

import { AgentHttpClient } from "./client";

const endpoint = new URL("https://example.convex.site/agent/v1/tools");
const secret = "rodge_agent_secret_0123456789abcdefghijklmnopqrstuvwxyz";
const listAccountsOutput = {
  content: {
    isUntrusted: true,
    notice: UNTRUSTED_MAIL_NOTICE,
  },
  accounts: [],
};

describe("agent HTTP client", () => {
  it("POSTs one validated tool request with the bearer only in Authorization", async () => {
    const fetchImplementation = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        Promise.resolve(jsonResponse(listAccountsOutput)),
    );
    const client = createClient({ fetchImplementation });

    await expect(client.call("list_accounts", {})).resolves.toEqual(
      listAccountsOutput,
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const request = fetchImplementation.mock.calls[0];
    const init = request?.[1];
    expect(request?.[0]).toEqual(endpoint);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      `Bearer ${secret}`,
    );
    const body = typeof init?.body === "string" ? init.body : "";
    expect(body).toContain('"tool":"list_accounts"');
    expect(body).not.toContain(secret);
  });

  it("validates input before transport and enforces the request cap", async () => {
    const fetchImplementation = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        Promise.resolve(jsonResponse(listAccountsOutput)),
    );
    const client = createClient({ fetchImplementation });
    await expect(client.call("search_mail", { query: "x" })).rejects.toThrow();
    expect(fetchImplementation).not.toHaveBeenCalled();

    const capped = createClient({ fetchImplementation, maxRequestBytes: 10 });
    await expect(capped.call("list_accounts", {})).rejects.toMatchObject({
      code: "REQUEST_TOO_LARGE",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("caps streamed responses before parsing", async () => {
    const padded = `${" ".repeat(256)}${JSON.stringify(listAccountsOutput)}`;
    const fetchImplementation = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        Promise.resolve(
          new Response(padded, {
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );
    const client = createClient({ fetchImplementation, maxResponseBytes: 100 });
    await expect(client.call("list_accounts", {})).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
    });
  });
});

describe("agent HTTP client error handling", () => {
  it("rejects invalid output without echoing response content or secrets", async () => {
    const fetchImplementation = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        Promise.resolve(jsonResponse({ token: secret, accounts: [] })),
    );
    const error = await captureError(
      createClient({ fetchImplementation }).call("list_accounts", {}),
    );
    expect(error).toMatchObject({ code: "INVALID_TOOL_OUTPUT" });
    expect(String(error)).not.toContain(secret);
  });

  it("surfaces only bounded endpoint error metadata", async () => {
    const fetchImplementation = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        Promise.resolve(
          jsonResponse(
            {
              error: {
                code: "INSUFFICIENT_SCOPE",
                message: `Do not expose ${secret}`,
                requestId: "server-request",
              },
            },
            403,
          ),
        ),
    );
    const error = await captureError(
      createClient({ fetchImplementation }).call("list_accounts", {}),
    );
    expect(error).toMatchObject({
      code: "INSUFFICIENT_SCOPE",
      requestId: "server-request",
      status: 403,
    });
    expect(String(error)).not.toContain(secret);
  });

  it("uses a fixed abort deadline and hides transport errors", async () => {
    const fetchImplementation = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        await waitForAbort(init?.signal);
        throw new Error(`Transport leaked ${secret}`);
      },
    );
    const error = await captureError(
      createClient({ fetchImplementation, timeoutMs: 5 }).call(
        "list_accounts",
        {},
      ),
    );
    expect(error).toMatchObject({ code: "ENDPOINT_TIMEOUT" });
    expect(String(error)).not.toContain(secret);
  });
});

function createClient(
  overrides: Partial<ConstructorParameters<typeof AgentHttpClient>[0]> = {},
) {
  return new AgentHttpClient({ endpoint, token: secret, ...overrides });
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected promise to reject");
}

async function waitForAbort(signal: AbortSignal | null | undefined) {
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    signal?.addEventListener("abort", () => resolve(), { once: true });
  });
}
