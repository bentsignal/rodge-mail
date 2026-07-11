import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

let client: Client | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe("MCP package startup", () => {
  it("initializes over stdio through the documented start script", async () => {
    const transport = new StdioClientTransport({
      command: "pnpm",
      args: ["--silent", "start"],
      cwd: new URL("..", import.meta.url).pathname,
      env: {
        RODGE_MAIL_AGENT_ENDPOINT: "https://example.com/agent/v1/tools",
        RODGE_MAIL_AGENT_TOKEN: "a".repeat(32),
      },
      stderr: "pipe",
    });
    client = new Client({ name: "startup-test", version: "0.1.0" });
    await client.connect(transport);

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "list_accounts",
      "search_mail",
      "get_thread",
    ]);
  });
});
