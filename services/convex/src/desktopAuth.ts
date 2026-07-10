import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

const desktopAuthValueSchema = z.object({
  authorizationCodeHash: z.string().optional(),
  codeChallenge: z.string(),
  userId: z.string().optional(),
});
const desktopAuthRequestSchema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
});
const desktopAuthBeginSchema = desktopAuthRequestSchema.extend({
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
});
const desktopAuthVerifierSchema = desktopAuthRequestSchema.extend({
  codeVerifier: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
});
const desktopAuthClaimSchema = desktopAuthVerifierSchema.extend({
  authorizationCode: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
});

const desktopAuthTtlMs = 5 * 60 * 1000;
const invalidHandoffMessage = "Desktop sign-in request is invalid or expired";
const invalidHandoffError = { message: invalidHandoffMessage };

interface VerificationValue {
  expiresAt: Date | number | string;
  value: string;
}

interface DesktopAuthVerificationAdapter {
  consumeVerificationValue: (
    identifier: string,
  ) => Promise<VerificationValue | null>;
  findVerificationValue: (
    identifier: string,
  ) => Promise<VerificationValue | null>;
}

export function desktopAuth() {
  return {
    id: "desktop-auth",
    endpoints: {
      beginDesktopAuth: createAuthEndpoint(
        "/desktop-auth/begin",
        { body: desktopAuthBeginSchema, method: "POST" },
        async (ctx) => {
          const identifier = getDesktopAuthIdentifier(ctx.body.requestId);
          const existing =
            await ctx.context.internalAdapter.findVerificationValue(identifier);
          if (existing) throw ctx.error("BAD_REQUEST", invalidHandoffError);

          const expiresAt = new Date(Date.now() + desktopAuthTtlMs);
          await ctx.context.internalAdapter.createVerificationValue({
            expiresAt,
            identifier,
            value: JSON.stringify({ codeChallenge: ctx.body.codeChallenge }),
          });
          return ctx.json({ expiresAt: expiresAt.toISOString() });
        },
      ),
      authorizeDesktopAuth: createAuthEndpoint(
        "/desktop-auth/authorize",
        {
          body: desktopAuthRequestSchema,
          method: "POST",
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const identifier = getDesktopAuthIdentifier(ctx.body.requestId);
          const verification =
            await ctx.context.internalAdapter.findVerificationValue(identifier);
          const handoff = parseDesktopAuthValue(verification, Date.now());
          if (!handoff) throw ctx.error("BAD_REQUEST", invalidHandoffError);

          const userId = ctx.context.session.user.id;
          if (handoff.userId && handoff.userId !== userId) {
            throw ctx.error("BAD_REQUEST", invalidHandoffError);
          }
          if (handoff.userId || handoff.authorizationCodeHash) {
            throw ctx.error("BAD_REQUEST", invalidHandoffError);
          }

          const authorizationCode = createRandomToken();
          const authorizationCodeHash =
            await createCodeChallenge(authorizationCode);
          await ctx.context.internalAdapter.updateVerificationByIdentifier(
            identifier,
            {
              value: JSON.stringify({
                authorizationCodeHash,
                codeChallenge: handoff.codeChallenge,
                userId,
              }),
            },
          );
          return ctx.json({ authorizationCode });
        },
      ),
      exchangeDesktopAuth: createAuthEndpoint(
        "/desktop-auth/exchange",
        { body: desktopAuthClaimSchema, method: "POST" },
        async (ctx) => {
          const handoff = await consumeDesktopAuthHandoff(
            ctx.context.internalAdapter,
            ctx.body,
            Date.now(),
          );
          if (!handoff?.userId) {
            throw ctx.error("BAD_REQUEST", invalidHandoffError);
          }

          const user = await ctx.context.internalAdapter.findUserById(
            handoff.userId,
          );
          if (!user) throw ctx.error("BAD_REQUEST", invalidHandoffError);
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
          );
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ success: true });
        },
      ),
      cancelDesktopAuth: createAuthEndpoint(
        "/desktop-auth/cancel",
        { body: desktopAuthVerifierSchema, method: "POST" },
        async (ctx) => {
          const handoff = await consumeDesktopAuthCancellation(
            ctx.context.internalAdapter,
            ctx.body,
            Date.now(),
          );
          if (!handoff) throw ctx.error("BAD_REQUEST", invalidHandoffError);
          return ctx.json({ success: true });
        },
      ),
    },
  };
}

export async function consumeDesktopAuthHandoff(
  adapter: DesktopAuthVerificationAdapter,
  claim: {
    authorizationCode?: string;
    codeVerifier?: string;
    requestId: string;
  },
  now: number,
) {
  const identifier = getDesktopAuthIdentifier(claim.requestId);
  const current = await adapter.findVerificationValue(identifier);
  const currentHandoff = parseDesktopAuthValue(current, now);
  if (!currentHandoff) return undefined;

  if (!claim.codeVerifier || !claim.authorizationCode) return undefined;
  const [challenge, authorizationCodeHash] = await Promise.all([
    createCodeChallenge(claim.codeVerifier),
    createCodeChallenge(claim.authorizationCode),
  ]);
  if (
    challenge !== currentHandoff.codeChallenge ||
    authorizationCodeHash !== currentHandoff.authorizationCodeHash
  ) {
    return undefined;
  }

  const consumed = await adapter.consumeVerificationValue(identifier);
  return parseDesktopAuthValue(consumed, now);
}

async function consumeDesktopAuthCancellation(
  adapter: DesktopAuthVerificationAdapter,
  claim: { codeVerifier: string; requestId: string },
  now: number,
) {
  const identifier = getDesktopAuthIdentifier(claim.requestId);
  const current = await adapter.findVerificationValue(identifier);
  const currentHandoff = parseDesktopAuthValue(current, now);
  if (!currentHandoff) return undefined;

  const challenge = await createCodeChallenge(claim.codeVerifier);
  if (challenge !== currentHandoff.codeChallenge) return undefined;

  const consumed = await adapter.consumeVerificationValue(identifier);
  return parseDesktopAuthValue(consumed, now);
}

export async function createCodeChallenge(codeVerifier: string) {
  const input = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToBase64Url(new Uint8Array(digest));
}

function getDesktopAuthIdentifier(requestId: string) {
  return `desktop-auth:${requestId}`;
}

function parseDesktopAuthValue(
  verification: VerificationValue | null,
  now: number,
) {
  if (!verification || getExpirationTime(verification.expiresAt) <= now) {
    return undefined;
  }
  try {
    const parsed = desktopAuthValueSchema.safeParse(
      JSON.parse(verification.value),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
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

function createRandomToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
