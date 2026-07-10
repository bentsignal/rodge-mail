import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

import { env } from "./env";

export const encryptedCredentialSchema = z
  .object({
    version: z.literal(1),
    keyVersion: z.string(),
    iv: z.string(),
    ciphertext: z.string(),
    authTag: z.string(),
  })
  .strict();

export type EncryptedCredential = z.infer<typeof encryptedCredentialSchema>;

const keyringSchema = z.record(z.string(), z.string());
const keyring = keyringSchema.parse(JSON.parse(env.BRIDGE_CREDENTIAL_KEYS));

export function encryptCredential(value: string, bridgeAccountId: string) {
  const keyVersion = env.BRIDGE_ACTIVE_CREDENTIAL_KEY_VERSION;
  const key = readKey(keyVersion);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(additionalData(bridgeAccountId)));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1 as const,
    keyVersion,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptCredential(
  encrypted: EncryptedCredential,
  bridgeAccountId: string,
) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    readKey(encrypted.keyVersion),
    Buffer.from(encrypted.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(additionalData(bridgeAccountId)));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function readKey(version: string) {
  const encoded = keyring[version];
  if (!encoded) throw new Error(`Credential key ${version} is unavailable`);
  const key = Buffer.from(encoded, "base64");
  if (key.byteLength !== 32) {
    throw new Error(`Credential key ${version} must decode to 32 bytes`);
  }
  return key;
}

function additionalData(bridgeAccountId: string) {
  return `rodge-mail:icloud-bridge:${bridgeAccountId}`;
}
