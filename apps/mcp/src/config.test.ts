import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadAdapterConfig } from "./config";

const endpoint = "https://example.convex.site/agent/v1/tools";
const token = "rodge_agent_0123456789abcdefghijklmnopqrstuvwxyz";
const temporaryDirectories = new Array<string>();

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe("MCP adapter configuration", () => {
  it("loads a direct token without normalizing or exposing it", async () => {
    const config = await loadAdapterConfig({
      RODGE_MAIL_AGENT_ENDPOINT: endpoint,
      RODGE_MAIL_AGENT_TOKEN: token,
    });
    expect(config.endpoint.href).toBe(endpoint);
    expect(config.token).toBe(token);
  });

  it("loads a non-symlink token file with exact 0600 permissions", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "agent-token");
    await writeFile(path, `${token}\n`, { mode: 0o600 });
    await chmod(path, 0o600);

    await expect(
      loadAdapterConfig({
        RODGE_MAIL_AGENT_ENDPOINT: endpoint,
        RODGE_MAIL_AGENT_TOKEN_FILE: path,
      }),
    ).resolves.toMatchObject({ token });
  });

  it("rejects permissive and symlinked token files", async () => {
    const directory = await temporaryDirectory();
    const permissive = join(directory, "permissive-token");
    const linked = join(directory, "linked-token");
    await writeFile(permissive, token, { mode: 0o644 });
    await chmod(permissive, 0o644);
    await symlink(permissive, linked);

    await expect(
      loadAdapterConfig({
        RODGE_MAIL_AGENT_ENDPOINT: endpoint,
        RODGE_MAIL_AGENT_TOKEN_FILE: permissive,
      }),
    ).rejects.toMatchObject({ code: "INSECURE_TOKEN_FILE" });
    await expect(
      loadAdapterConfig({
        RODGE_MAIL_AGENT_ENDPOINT: endpoint,
        RODGE_MAIL_AGENT_TOKEN_FILE: linked,
      }),
    ).rejects.toMatchObject({ code: "INSECURE_TOKEN_FILE" });
  });

  it("rejects ambiguous credentials and unsafe endpoints", async () => {
    await expect(
      loadAdapterConfig({
        RODGE_MAIL_AGENT_ENDPOINT: endpoint,
        RODGE_MAIL_AGENT_TOKEN: token,
        RODGE_MAIL_AGENT_TOKEN_FILE: "/tmp/token",
      }),
    ).rejects.toMatchObject({ code: "AMBIGUOUS_TOKEN_SOURCE" });
    await expect(
      loadAdapterConfig({
        RODGE_MAIL_AGENT_ENDPOINT: "http://localhost/agent",
        RODGE_MAIL_AGENT_TOKEN: token,
      }),
    ).rejects.toMatchObject({ code: "INVALID_AGENT_ENDPOINT" });
  });
});

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "rodge-mail-mcp-"));
  temporaryDirectories.push(directory);
  return directory;
}
