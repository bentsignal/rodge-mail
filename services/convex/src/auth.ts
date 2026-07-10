import type { AuthFunctions, GenericCtx } from "@convex-dev/better-auth";
import type { BetterAuthOptions } from "better-auth/minimal";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { createClient } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";

import type { DataModel } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { primaryAuthConfig } from "./auth.config";
import authSchema from "./betterAuth/schema";
import { env } from "./convex.env";
import { sendRegistrationEmail } from "./registrationEmail";
import { urls } from "./urls";

// eslint-disable-next-line no-restricted-syntax -- This preserves Better Auth's generated Convex API typing.
const authFunctions: AuthFunctions = internal.auth;
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
      emailOTP({
        allowedAttempts: 3,
        expiresIn: 300,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }, authCtx) => {
          if (type !== "sign-in" || !authCtx) return;

          const existing =
            await authCtx.context.internalAdapter.findUserByEmail(email);
          if (existing) {
            const existingPasskey = await authCtx.context.adapter.findOne({
              model: "passkey",
              where: [{ field: "userId", value: existing.user.id }],
            });
            if (existingPasskey) return;
          }

          await sendRegistrationEmail({
            apiKey: env.RESEND_API_KEY,
            from: env.AUTH_EMAIL_FROM,
            otp,
            to: email,
          });
        },
      }),
      passkey({
        origin: passkeyOrigins,
        rpID: env.PASSKEY_RP_ID,
        rpName: "Rodge Mail",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
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

function getAndroidPasskeyOrigins() {
  return (process.env.ANDROID_PASSKEY_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) =>
      /^android:apk-key-hash:[A-Za-z0-9+/]+={0,2}$/u.test(origin),
    );
}
