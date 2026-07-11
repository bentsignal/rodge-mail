import { createAuthEndpoint } from "better-auth/api";
import {
  generateRandomString,
  hashPassword,
  verifyPassword,
} from "better-auth/crypto";
import { z } from "zod";

import { sendRecoveryEmail } from "./registrationEmail";

const recoveryCodeTtlMs = 5 * 60 * 1000;
const recoveryGrantTtlMs = 5 * 60 * 1000;
const maximumCodeAttempts = 3;
const invalidRecoveryMessage = "The recovery code is invalid or expired";
const recoveryCodeValueSchema = z.object({
  attempts: z.number().int().min(0),
  codeHash: z.string().min(1),
  userId: z.string().min(1),
});
const recoveryGrantValueSchema = z.object({
  userId: z.string().min(1),
});
const emailSchema = z
  .string()
  .email()
  .transform((email) => email.toLowerCase());
const requestRecoverySchema = z.object({ email: emailSchema });
const verifyRecoverySchema = z.object({
  code: z.string().regex(/^\d{6}$/u),
  email: emailSchema,
});

interface RecoveryOptions {
  apiKey: string;
  from: string;
}

interface VerificationValue {
  expiresAt: Date | number | string;
  value: string;
}

interface RecoveryAdapter {
  consumeVerificationValue: (
    identifier: string,
  ) => Promise<VerificationValue | null>;
  createVerificationValue: (value: {
    expiresAt: Date;
    identifier: string;
    value: string;
  }) => Promise<unknown>;
  deleteVerificationByIdentifier: (identifier: string) => Promise<void>;
  findVerificationValue: (
    identifier: string,
  ) => Promise<VerificationValue | null>;
}

export function passkeyRecovery(options: RecoveryOptions) {
  return {
    id: "passkey-recovery",
    rateLimit: [
      {
        max: 3,
        pathMatcher: (path: string) => path === "/passkey-recovery/request",
        window: 60,
      },
      {
        max: 3,
        pathMatcher: (path: string) => path === "/passkey-recovery/verify",
        window: 60,
      },
    ],
    endpoints: {
      requestPasskeyRecovery: createAuthEndpoint(
        "/passkey-recovery/request",
        { body: requestRecoverySchema, method: "POST" },
        async (ctx) => {
          const existing = await ctx.context.internalAdapter.findUserByEmail(
            ctx.body.email,
          );
          if (!existing) return ctx.json({ success: true });

          const passkey = await ctx.context.adapter.findOne({
            model: "passkey",
            where: [{ field: "userId", value: existing.user.id }],
          });
          if (!passkey) return ctx.json({ success: true });

          const code = generateRandomString(6, "0-9");
          const codeHash = await hashPassword(code);
          const identifier = getRecoveryCodeIdentifier(ctx.body.email);
          await replaceVerificationValue(ctx.context.internalAdapter, {
            expiresAt: new Date(Date.now() + recoveryCodeTtlMs),
            identifier,
            value: JSON.stringify({
              attempts: 0,
              codeHash,
              userId: existing.user.id,
            }),
          });
          await sendRecoveryEmail({
            apiKey: options.apiKey,
            from: options.from,
            otp: code,
            to: ctx.body.email,
          });
          return ctx.json({ success: true });
        },
      ),
      verifyPasskeyRecovery: createAuthEndpoint(
        "/passkey-recovery/verify",
        { body: verifyRecoverySchema, method: "POST" },
        async (ctx) => {
          const adapter = ctx.context.internalAdapter;
          const identifier = getRecoveryCodeIdentifier(ctx.body.email);
          const consumed = await adapter.consumeVerificationValue(identifier);
          const recovery = parseRecoveryCodeValue(consumed, Date.now());
          if (!recovery || recovery.attempts >= maximumCodeAttempts) {
            throw ctx.error("BAD_REQUEST", { message: invalidRecoveryMessage });
          }

          const isValid = await verifyPassword({
            hash: recovery.codeHash,
            password: ctx.body.code,
          });
          if (!isValid) {
            const attempts = recovery.attempts + 1;
            if (attempts < maximumCodeAttempts && consumed) {
              await adapter.createVerificationValue({
                expiresAt: new Date(getExpirationTime(consumed.expiresAt)),
                identifier,
                value: JSON.stringify({ ...recovery, attempts }),
              });
            }
            throw ctx.error("BAD_REQUEST", { message: invalidRecoveryMessage });
          }

          const user = await adapter.findUserById(recovery.userId);
          if (!user) {
            throw ctx.error("BAD_REQUEST", { message: invalidRecoveryMessage });
          }
          if (!user.emailVerified) {
            await adapter.updateUser(user.id, { emailVerified: true });
          }

          const recoveryToken = await createPasskeyRecoveryGrant(
            adapter,
            recovery.userId,
          );
          return ctx.json({ recoveryToken });
        },
      ),
    },
  };
}

export async function createPasskeyRecoveryGrant(
  adapter: RecoveryAdapter,
  userId: string,
) {
  const recoveryToken = generateRandomString(32);
  const identifier = await getRecoveryGrantIdentifier(recoveryToken);
  await adapter.createVerificationValue({
    expiresAt: new Date(Date.now() + recoveryGrantTtlMs),
    identifier,
    value: JSON.stringify({ userId }),
  });
  return recoveryToken;
}

export async function resolvePasskeyRecoveryUser(
  adapter: RecoveryAdapter,
  token: string | null | undefined,
) {
  if (!token) return undefined;
  const identifier = await getRecoveryGrantIdentifier(token);
  return parseRecoveryGrantValue(
    await adapter.findVerificationValue(identifier),
    Date.now(),
  );
}

export async function consumePasskeyRecoveryGrant(
  adapter: RecoveryAdapter,
  token: string,
) {
  const identifier = await getRecoveryGrantIdentifier(token);
  return parseRecoveryGrantValue(
    await adapter.consumeVerificationValue(identifier),
    Date.now(),
  );
}

async function replaceVerificationValue(
  adapter: RecoveryAdapter,
  next: { expiresAt: Date; identifier: string; value: string },
) {
  const existing = await adapter.findVerificationValue(next.identifier);
  if (existing) await adapter.deleteVerificationByIdentifier(next.identifier);
  await adapter.createVerificationValue(next);
}

function parseRecoveryCodeValue(
  verification: VerificationValue | null,
  now: number,
) {
  if (!verification || getExpirationTime(verification.expiresAt) <= now) {
    return undefined;
  }
  return parseValue(recoveryCodeValueSchema, verification.value);
}

function parseRecoveryGrantValue(
  verification: VerificationValue | null,
  now: number,
) {
  if (!verification || getExpirationTime(verification.expiresAt) <= now) {
    return undefined;
  }
  return parseValue(recoveryGrantValueSchema, verification.value);
}

function parseValue<T>(schema: z.ZodType<T>, value: string) {
  try {
    const parsed = schema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function getRecoveryCodeIdentifier(email: string) {
  return `passkey-recovery-code:${email}`;
}

async function getRecoveryGrantIdentifier(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `passkey-recovery-grant:${bytesToBase64Url(new Uint8Array(digest))}`;
}

function getExpirationTime(expiresAt: Date | number | string) {
  const expirationTime =
    expiresAt instanceof Date
      ? expiresAt.getTime()
      : typeof expiresAt === "number"
        ? expiresAt
        : Date.parse(expiresAt);
  return Number.isFinite(expirationTime) ? expirationTime : 0;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}
