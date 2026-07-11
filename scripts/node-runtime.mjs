import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const supportedNodeMajor = 22;
export const minimumNodeMinor = 12;

export function isSupportedNodeVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  return (
    match !== null &&
    Number(match[1]) === supportedNodeMajor &&
    Number(match[2]) >= minimumNodeMinor
  );
}

function readNodeVersion(binary) {
  const result = spawnSync(binary, ["-p", "process.versions.node"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function nvmCandidates(nvmDirectory) {
  const versionsDirectory = join(nvmDirectory, "versions", "node");
  if (!existsSync(versionsDirectory)) return [];

  return readdirSync(versionsDirectory)
    .filter((entry) => entry.startsWith(`v${supportedNodeMajor}.`))
    .sort((left, right) =>
      right.localeCompare(left, undefined, { numeric: true }),
    )
    .map((entry) => join(versionsDirectory, entry, "bin", "node"));
}

export function findSupportedNodeBinary({
  currentBinary = process.execPath,
  currentVersion = process.versions.node,
  environment = process.env,
  homeDirectory = homedir(),
} = {}) {
  if (isSupportedNodeVersion(currentVersion)) return currentBinary;

  const candidates = [
    environment.RODGE_NODE_BINARY,
    environment.NVM_BIN ? join(environment.NVM_BIN, "node") : undefined,
    ...nvmCandidates(environment.NVM_DIR ?? join(homeDirectory, ".nvm")),
    "/opt/homebrew/opt/node@22/bin/node",
    "/usr/local/opt/node@22/bin/node",
  ];

  for (const candidate of candidates) {
    if (!candidate || !existsSync(candidate)) continue;
    const version = readNodeVersion(candidate);
    if (version && isSupportedNodeVersion(version)) return candidate;
  }

  throw new Error(
    `Rodge Mail web development requires Node 22.12 or newer within the Node 22 line. Current runtime: ${currentVersion}. Run \`nvm install 22 && nvm use 22\`, or set RODGE_NODE_BINARY to a compatible Node executable.`,
  );
}
