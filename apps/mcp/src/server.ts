import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { AgentToolName } from "@rodge-mail/agent-contract";
import { agentToolDefinitions } from "@rodge-mail/agent-contract";

import type { AgentToolCaller } from "./client.ts";
import type { AdapterLogger } from "./logger.ts";
import { adapterErrorCode } from "./errors.ts";

export function createAgentMcpServer(
  client: AgentToolCaller,
  logger: AdapterLogger,
) {
  const server = new McpServer({ name: "rodge-mail", version: "0.1.0" });
  registerTool(server, agentToolDefinitions[0], client, logger);
  registerTool(server, agentToolDefinitions[1], client, logger);
  registerTool(server, agentToolDefinitions[2], client, logger);
  return server;
}

function registerTool<TTool extends (typeof agentToolDefinitions)[number]>(
  server: McpServer,
  tool: TTool,
  client: AgentToolCaller,
  logger: AdapterLogger,
) {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
    },
    async (input: unknown) =>
      await executeTool(tool.name, input, client, logger),
  );
}

// eslint-disable-next-line no-restricted-syntax -- The SDK callback needs its protocol result type preserved across heterogeneous contract tools.
async function executeTool(
  tool: AgentToolName,
  input: unknown,
  client: AgentToolCaller,
  logger: AdapterLogger,
): Promise<CallToolResult> {
  const definition = getToolDefinition(tool);
  try {
    const validatedInput = definition.inputSchema.parse(input);
    const result = await client.call(tool, validatedInput);
    const validatedOutput = definition.outputSchema.parse(result);
    return {
      content: [{ type: "text", text: JSON.stringify(validatedOutput) }],
      structuredContent: validatedOutput,
    };
  } catch (error) {
    logger.error("tool_request_failed", error, tool);
    return {
      content: [
        {
          type: "text",
          text: `Rodge Mail tool request failed (${adapterErrorCode(error)}).`,
        },
      ],
      isError: true,
    };
  }
}

function getToolDefinition(tool: AgentToolName) {
  if (tool === "list_accounts") return agentToolDefinitions[0];
  if (tool === "search_mail") return agentToolDefinitions[1];
  return agentToolDefinitions[2];
}
