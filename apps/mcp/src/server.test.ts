import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UNTRUSTED_MAIL_NOTICE } from "@rodge-mail/agent-contract";

import type { AgentToolCaller } from "./client";
import type { AdapterLogger } from "./logger";
import { createAgentMcpServer } from "./server";

const listAccountsOutput = {
  content: {
    isUntrusted: true,
    notice: UNTRUSTED_MAIL_NOTICE,
  },
  accounts: [],
};

let client: Client;
let closeServer: () => Promise<void>;
let toolCaller: AgentToolCaller;
let logger: AdapterLogger;

beforeEach(async () => {
  toolCaller = {
    call: vi.fn(() => Promise.resolve(listAccountsOutput)),
  };
  logger = { error: vi.fn() };
  const server = createAgentMcpServer(toolCaller, logger);
  client = new Client({ name: "rodge-mail-test", version: "0.1.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  closeServer = async () => {
    await Promise.all([client.close(), server.close()]);
  };
});

afterEach(async () => {
  await closeServer();
});

describe("Rodge Mail MCP server", () => {
  it("advertises exactly three closed-world read-only tools", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "list_accounts",
      "search_mail",
      "get_thread",
    ]);
    for (const tool of tools.tools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(tool.description).toContain(UNTRUSTED_MAIL_NOTICE);
    }
  });

  it("returns validated structured content", async () => {
    const result = await client.callTool({
      name: "list_accounts",
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual(listAccountsOutput);
    expect(toolCaller.call).toHaveBeenCalledWith("list_accounts", {});
  });

  it("has no mutation or send path", async () => {
    const result = await client.callTool({ name: "send_mail", arguments: {} });
    expect(result.isError).toBe(true);
    expect(toolCaller.call).not.toHaveBeenCalled();
  });

  it("does not expose caller errors or secrets through MCP or diagnostics", async () => {
    const secret = "rodge_agent_secret_abcdefghijklmnopqrstuvwxyz";
    toolCaller.call = vi.fn(() =>
      Promise.reject(new Error(`Never expose ${secret}`)),
    );
    const result = await client.callTool({
      name: "list_accounts",
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(logger.error).toHaveBeenCalledWith(
      "tool_request_failed",
      expect.any(Error),
      "list_accounts",
    );
  });
});
