import { lstat, readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { AgentAdapterError } from "./errors.ts";

const TOKEN_FILE_MODE = 0o600;
const MAX_TOKEN_FILE_BYTES = 1_024;
const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{32,512}$/u;

interface AdapterEnvironment {
  [key: string]: string | undefined;
  RODGE_MAIL_AGENT_ENDPOINT?: string;
  RODGE_MAIL_AGENT_TOKEN?: string;
  RODGE_MAIL_AGENT_TOKEN_FILE?: string;
}

export async function loadAdapterConfig(
  environment: AdapterEnvironment = process.env,
) {
  const endpoint = parseEndpoint(environment.RODGE_MAIL_AGENT_ENDPOINT);
  const directToken = environment.RODGE_MAIL_AGENT_TOKEN;
  const tokenFile = environment.RODGE_MAIL_AGENT_TOKEN_FILE;
  if (directToken && tokenFile) {
    throw new AgentAdapterError("AMBIGUOUS_TOKEN_SOURCE");
  }
  const token = directToken ?? (await readTokenFile(tokenFile));
  if (!token || !TOKEN_PATTERN.test(token)) {
    throw new AgentAdapterError("INVALID_AGENT_TOKEN");
  }
  return { endpoint, token };
}

function parseEndpoint(value: string | undefined) {
  if (!value) throw new AgentAdapterError("MISSING_AGENT_ENDPOINT");
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new AgentAdapterError("INVALID_AGENT_ENDPOINT");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new AgentAdapterError("INVALID_AGENT_ENDPOINT");
  }
  return endpoint;
}

async function readTokenFile(path: string | undefined) {
  if (!path) return undefined;
  if (!isAbsolute(path)) throw new AgentAdapterError("TOKEN_FILE_NOT_ABSOLUTE");
  let metadata;
  try {
    metadata = await lstat(path);
  } catch {
    throw new AgentAdapterError("TOKEN_FILE_UNAVAILABLE");
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    (metadata.mode & 0o777) !== TOKEN_FILE_MODE ||
    metadata.size > MAX_TOKEN_FILE_BYTES
  ) {
    throw new AgentAdapterError("INSECURE_TOKEN_FILE");
  }
  try {
    return (await readFile(path, "utf8")).trimEnd();
  } catch {
    throw new AgentAdapterError("TOKEN_FILE_UNAVAILABLE");
  }
}
