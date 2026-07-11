const TOKEN_PREFIX = "rodge_agent_";
const TOKEN_PATTERN = /^rodge_agent_[A-Za-z0-9_-]{43}$/u;

export function createAgentToken() {
  return `${TOKEN_PREFIX}${bytesToBase64Url(
    crypto.getRandomValues(new Uint8Array(32)),
  )}`;
}

export function isAgentToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

export async function hashAgentToken(token: string) {
  return await hashBytes(new TextEncoder().encode(`rodge-mail:agent:${token}`));
}

export async function hashAgentArguments(value: Uint8Array | string) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return await hashBytes(bytes);
}

export function credentialFingerprint(tokenHash: string) {
  return tokenHash.slice(0, 16);
}

async function hashBytes(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}
