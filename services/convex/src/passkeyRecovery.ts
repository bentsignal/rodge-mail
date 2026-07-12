import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import {
  generateRandomString,
  hashPassword,
  verifyPassword,
} from "better-auth/crypto";
import { z } from "zod";

import { sendRecoveryEmail } from "./registrationEmail";

const recoveryCodeTtlMs = 5 * 60 * 1000;
const maximumCodeAttempts = 3;
const invalidRecoveryMessage = "The recovery code is invalid or expired";
const recoveryCodeValueSchema = z.object({
  attempts: z.number().int().min(0),
  codeHash: z.string().min(1),
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

interface RecoveryUser {
  id: string;
  emailVerified: boolean;
}

interface RecoverySession {
  token: string;
}

interface RecoveryVerificationAdapter {
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

interface RecoveryAdapter<
  TUser extends RecoveryUser,
  TSession extends RecoverySession,
> extends RecoveryVerificationAdapter {
  createSession: (userId: string) => Promise<TSession>;
  deleteSession: (token: string) => Promise<void>;
  findUserById: (userId: string) => Promise<TUser | null>;
  updateUser: (
    userId: string,
    update: { emailVerified: true },
  ) => Promise<TUser>;
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
          const success = await completePasskeyRecovery({
            adapter,
            code: ctx.body.code,
            email: ctx.body.email,
            now: Date.now(),
            setSession: async (auth) => {
              await setSessionCookie(ctx, auth);
            },
          });
          if (!success) {
            throw ctx.error("BAD_REQUEST", { message: invalidRecoveryMessage });
          }
          return ctx.json({ success: true });
        },
      ),
    },
  };
}

export async function completePasskeyRecovery<
  TUser extends RecoveryUser,
  TSession extends RecoverySession,
>({
  adapter,
  code,
  email,
  now,
  setSession,
}: {
  adapter: RecoveryAdapter<TUser, TSession>;
  code: string;
  email: string;
  now: number;
  setSession: (auth: { session: TSession; user: TUser }) => Promise<void>;
}) {
  const identifier = getRecoveryCodeIdentifier(email);
  const consumed = await adapter.consumeVerificationValue(identifier);
  const recovery = parseRecoveryCodeValue(consumed, now);
  if (!recovery || recovery.attempts >= maximumCodeAttempts) return false;

  const isValid = await verifyPassword({
    hash: recovery.codeHash,
    password: code,
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
    return false;
  }

  const existingUser = await adapter.findUserById(recovery.userId);
  if (!existingUser) return false;
  const user = existingUser.emailVerified
    ? existingUser
    : await adapter.updateUser(existingUser.id, { emailVerified: true });
  const session = await adapter.createSession(user.id);
  try {
    await setSession({ session, user });
  } catch (error) {
    await adapter.deleteSession(session.token).catch(() => undefined);
    throw error;
  }
  return true;
}

async function replaceVerificationValue(
  adapter: RecoveryVerificationAdapter,
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

function getExpirationTime(expiresAt: Date | number | string) {
  const expirationTime =
    expiresAt instanceof Date
      ? expiresAt.getTime()
      : typeof expiresAt === "number"
        ? expiresAt
        : Date.parse(expiresAt);
  return Number.isFinite(expirationTime) ? expirationTime : 0;
}
