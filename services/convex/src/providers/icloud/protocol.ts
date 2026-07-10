import { setupTokenPayloadSchema } from "./contract";

const encoder = new TextEncoder();

export const BRIDGE_PROTOCOL_VERSION = 1;
export const BRIDGE_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1_000;

export async function signSetupToken(
  payload: {
    version: 1;
    challengeId: string;
    ownerId: string;
    returnPath: string;
    expiresAt: number;
  },
  secret: string,
) {
  const encodedPayload = encodeBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  const signature = await hmac(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySetupToken(token: string, secret: string) {
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) return null;
  const expected = await hmac(encodedPayload, secret);
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const json = new TextDecoder().decode(decodeBase64Url(encodedPayload));
    const payload = setupTokenPayloadSchema.parse(JSON.parse(json));
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function signBridgeRequest(
  input: {
    timestamp: string;
    requestId: string;
    method: string;
    pathname: string;
    body: string;
  },
  secret: string,
) {
  const bodyHash = await sha256(input.body);
  return await hmac(
    [
      input.timestamp,
      input.requestId,
      input.method.toUpperCase(),
      input.pathname,
      bodyHash,
    ].join("."),
    secret,
  );
}

export async function verifyBridgeRequestSignature(
  input: {
    timestamp: string;
    requestId: string;
    method: string;
    pathname: string;
    body: string;
    signature: string;
    now?: number;
  },
  secret: string,
) {
  const timestamp = Number(input.timestamp);
  const now = input.now ?? Date.now();
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(now - timestamp) > BRIDGE_SIGNATURE_MAX_AGE_MS
  ) {
    return false;
  }
  const expected = await signBridgeRequest(input, secret);
  return constantTimeEqual(input.signature, expected);
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
