import type { AuthFunctions, GenericCtx } from "@convex-dev/better-auth";
import type { BetterAuthOptions } from "better-auth/minimal";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { createClient } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";

import type { DataModel } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { primaryAuthConfig } from "./auth.config";
import authSchema from "./betterAuth/schema";
import { env } from "./convex.env";
import { urls } from "./urls";

// eslint-disable-next-line no-restricted-syntax -- This preserves Better Auth's generated Convex API typing.
const authFunctions: AuthFunctions = internal.auth;
const androidPasskeyOrigins = getAndroidPasskeyOrigins();
const trustedOrigins =
  env.ENVIRONMENT === "production"
    ? [urls.web, "rodge-mail://", ...androidPasskeyOrigins]
    : [
        urls.web,
        "https://*.rodge-mail.local",
        "https://*.www.rodge-mail.local",
        "rodge-mail://",
        ...androidPasskeyOrigins,
      ];
export const authCorsAllowedOrigins =
  env.ENVIRONMENT === "production"
    ? []
    : ["*.rodge-mail.local", "*.www.rodge-mail.local"];

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    authFunctions,
    local: { schema: authSchema },
    triggers: {},
  },
);

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
  return {
    appName: "Rodge Mail",
    baseURL: urls.convex.site,
    database: authComponent.adapter(ctx),
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    plugins: [
      passkey({
        origin: [urls.web, ...androidPasskeyOrigins],
        rpID: env.PASSKEY_RP_ID,
        rpName: "Rodge Mail",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
        registration: {
          requireSession: false,
          resolveUser: async ({ context, ctx: authCtx }) => {
            await verifyBootstrapContext(context);
            const email = normalizeOwnerEmail(env.OWNER_EMAIL);
            const existing =
              await authCtx.context.internalAdapter.findUserByEmail(email);
            const user =
              existing?.user ??
              (await authCtx.context.internalAdapter.createUser({
                email,
                emailVerified: true,
                name: env.OWNER_NAME,
              }));

            return {
              id: user.id,
              name: email,
              displayName: env.OWNER_NAME,
            };
          },
        },
      }),
      expo(),
      crossDomain({ siteUrl: urls.web }),
      convex({ authConfig: primaryAuthConfig }),
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth(createAuthOptions(ctx));
}

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

async function verifyBootstrapContext(context?: string | null) {
  const secret = env.OWNER_BOOTSTRAP_TOKEN;
  if (
    !secret ||
    secret.length < 32 ||
    !context ||
    !(await securelyEqual(context, secret))
  ) {
    throw new APIError("UNAUTHORIZED", {
      message: "Passkey bootstrap is unavailable",
    });
  }
}

async function securelyEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= (leftBytes.at(index) ?? 0) ^ (rightBytes.at(index) ?? 0);
  }
  return difference === 0;
}

function normalizeOwnerEmail(email: string) {
  return email.trim().toLowerCase();
}

function getAndroidPasskeyOrigins() {
  return (process.env.ANDROID_PASSKEY_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) =>
      /^android:apk-key-hash:[A-Za-z0-9+/]+={0,2}$/u.test(origin),
    );
}
