import type { AuthFunctions, GenericCtx } from "@convex-dev/better-auth";
import type { BetterAuthOptions } from "better-auth/minimal";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { createClient } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";

import { parsePasskeyRegistrationContext } from "@rodge-mail/config/auth";

import type { DataModel } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { primaryAuthConfig } from "./auth.config";
import authSchema from "./betterAuth/schema";
import { env } from "./convex.env";
import { urls } from "./urls";

// eslint-disable-next-line no-restricted-syntax -- This preserves Better Auth's generated Convex API typing.
const authFunctions: AuthFunctions = internal.auth;
const pendingRegistrationPrefix = "pending-passkey:";
const androidPasskeyOrigins = getAndroidPasskeyOrigins();
const passkeyRpOrigin = `https://${env.PASSKEY_RP_ID}`;
const passkeyOrigins = [
  ...new Set([urls.web, passkeyRpOrigin, ...androidPasskeyOrigins]),
];
const trustedOrigins = [
  ...new Set(
    env.ENVIRONMENT === "production"
      ? [urls.web, passkeyRpOrigin, "rodge-mail://", ...androidPasskeyOrigins]
      : [
          urls.web,
          passkeyRpOrigin,
          "https://*.rodge-mail.local",
          "https://*.www.rodge-mail.local",
          "rodge-mail://",
          ...androidPasskeyOrigins,
        ],
  ),
];
export const authCorsAllowedOrigins =
  env.ENVIRONMENT === "production"
    ? [passkeyRpOrigin]
    : [passkeyRpOrigin, "*.rodge-mail.local", "*.www.rodge-mail.local"];

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
        origin: passkeyOrigins,
        rpID: env.PASSKEY_RP_ID,
        rpName: "Rodge Mail",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
        registration: {
          requireSession: false,
          resolveUser: async ({ context, ctx: authCtx }) => {
            const registration = requirePasskeyRegistration(context);
            const existing =
              await authCtx.context.internalAdapter.findUserByEmail(
                registration.email,
              );
            if (existing) {
              throw new APIError("BAD_REQUEST", {
                message: "This account already exists. Sign in instead.",
              });
            }
            return {
              id: `${pendingRegistrationPrefix}${crypto.randomUUID()}`,
              name: registration.email,
              displayName: registration.name,
            };
          },
          afterVerification: async ({ context, ctx: authCtx, user }) => {
            if (!user.id.startsWith(pendingRegistrationPrefix)) return;
            const registration = requirePasskeyRegistration(context);
            const existing =
              await authCtx.context.internalAdapter.findUserByEmail(
                registration.email,
              );
            if (existing) {
              throw new APIError("BAD_REQUEST", {
                message: "This account already exists. Sign in instead.",
              });
            }
            const created = await authCtx.context.internalAdapter.createUser({
              email: registration.email,
              emailVerified: false,
              name: registration.name,
            });
            return { userId: created.id };
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

function requirePasskeyRegistration(context: string | null | undefined) {
  const registration = parsePasskeyRegistrationContext(context);
  if (!registration) {
    throw new APIError("BAD_REQUEST", {
      message: "Enter a valid name and email address",
    });
  }
  return registration;
}

function getAndroidPasskeyOrigins() {
  return (process.env.ANDROID_PASSKEY_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) =>
      /^android:apk-key-hash:[A-Za-z0-9+/]+={0,2}$/u.test(origin),
    );
}
