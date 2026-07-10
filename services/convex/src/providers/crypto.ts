/* eslint-disable no-restricted-syntax, @typescript-eslint/consistent-type-assertions -- Crypto and JSON boundaries require explicit generic contracts. */
import { env } from "../convex.env";

export interface EncryptedEnvelope {
  formatVersion: 1;
  keyVersion: string;
  iv: string;
  ciphertext: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function encryptProviderSecret(
  value: unknown,
  additionalData: string,
): Promise<EncryptedEnvelope> {
  const keyVersion = getActiveKeyVersion();
  const key = await importKey(keyVersion);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(additionalData),
      tagLength: 128,
    },
    key,
    plaintext,
  );

  return {
    formatVersion: 1,
    keyVersion,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptProviderSecret<T>(
  envelope: EncryptedEnvelope,
  additionalData: string,
): Promise<T> {
  const key = await importKey(envelope.keyVersion);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64Url(envelope.iv),
      additionalData: encoder.encode(additionalData),
      tagLength: 128,
    },
    key,
    decodeBase64Url(envelope.ciphertext),
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

export function randomBase64Url(byteLength: number) {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function credentialAdditionalData(
  ownerId: string,
  accountId: string,
  provider: string,
) {
  return `rodge-mail:credential:${provider}:${ownerId}:${accountId}`;
}

export function oauthStateAdditionalData(ownerId: string, stateHash: string) {
  return `rodge-mail:oauth-state:gmail:${ownerId}:${stateHash}`;
}

function getActiveKeyVersion() {
  const version = env.PROVIDER_ACTIVE_CREDENTIAL_KEY_VERSION?.trim();
  if (!version) {
    throw new Error("PROVIDER_ACTIVE_CREDENTIAL_KEY_VERSION is not configured");
  }
  return version;
}

async function importKey(version: string) {
  const encodedKey = readKeyring()[version];
  if (!encodedKey) {
    throw new Error(`Provider credential key ${version} is not configured`);
  }
  const rawKey = decodeBase64Url(encodedKey);
  if (rawKey.byteLength !== 32) {
    throw new Error(`Provider credential key ${version} must contain 32 bytes`);
  }
  return await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function readKeyring(): Record<string, string> {
  if (!env.PROVIDER_CREDENTIAL_KEYS) {
    throw new Error("PROVIDER_CREDENTIAL_KEYS is not configured");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(env.PROVIDER_CREDENTIAL_KEYS);
  } catch {
    throw new Error("PROVIDER_CREDENTIAL_KEYS must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("PROVIDER_CREDENTIAL_KEYS must be a version-to-key object");
  }
  for (const value of Object.values(parsed)) {
    if (typeof value !== "string") {
      throw new Error("Every provider credential key must be a string");
    }
  }
  return parsed as Record<string, string>;
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
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
