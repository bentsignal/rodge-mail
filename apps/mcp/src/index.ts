import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { AgentHttpClient } from "./client.ts";
import { loadAdapterConfig } from "./config.ts";
import { createStderrLogger } from "./logger.ts";
import { createAgentMcpServer } from "./server.ts";

const logger = createStderrLogger();

async function main() {
  const config = await loadAdapterConfig();
  const client = new AgentHttpClient(config);
  const server = createAgentMcpServer(client, logger);
  await server.connect(new StdioServerTransport());
}

try {
  await main();
} catch (error) {
  logger.error("startup_failed", error);
  process.exitCode = 1;
}
