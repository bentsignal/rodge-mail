import type { AuthFunctions, GenericCtx } from "@convex-dev/better-auth";
import type { BetterAuthOptions } from "better-auth/minimal";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { createClient } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";

import { nativeAuthBasePath } from "@rodge-mail/config/auth";

import type { DataModel } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { primaryAuthConfig } from "./auth.config";
import authSchema from "./betterAuth/schema";
import { env } from "./convex.env";
import { desktopAuth } from "./desktopAuth";
import { passkeyRecovery } from "./passkeyRecovery";
import { sendRegistrationEmail } from "./registrationEmail";
import { urls } from "./urls";

// eslint-disable-next-line no-restricted-syntax -- This preserves Better Auth's generated Convex API typing.
const authFunctions: AuthFunctions = internal.auth;
const androidPasskeyOrigins = getAndroidPasskeyOrigins();
const desktopBrowserAuthOrigin = getDesktopBrowserAuthOrigin();
const nativePasskeyRpId = new URL(urls.convex.site).hostname;

export const authCorsAllowedOrigins = getAuthCorsAllowedOrigins(
  env.PASSKEY_RP_ID,
);
export const nativeAuthCorsAllowedOrigins =
  getAuthCorsAllowedOrigins(nativePasskeyRpId);

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    authFunctions,
    local: { schema: authSchema },
    triggers: {},
  },
);

export function createAuthOptions(
  ctx: GenericCtx<DataModel>,
  options: { basePath?: string; passkeyRpId?: string } = {},
) {
  const passkeyRpId = options.passkeyRpId ?? env.PASSKEY_RP_ID;
  const { passkeyOrigins, trustedOrigins } = getAuthOrigins(passkeyRpId);

  return {
    appName: "Rodge Mail",
    ...(options.basePath ? { basePath: options.basePath } : {}),
    baseURL: urls.convex.site,
    database: authComponent.adapter(ctx),
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    plugins: [
      desktopAuth(),
      passkeyRecovery({
        apiKey: env.RESEND_API_KEY,
        from: env.AUTH_EMAIL_FROM,
      }),
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
        rpID: passkeyRpId,
        rpName: "Rodge Mail",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
      }),
      expo(),
      crossDomain({ siteUrl: urls.web }),
      convex({
        authConfig: primaryAuthConfig,
        ...(options.basePath
          ? { options: { basePath: options.basePath } }
          : {}),
      }),
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth(createAuthOptions(ctx));
}

export function createNativeAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth(
    createAuthOptions(ctx, {
      basePath: nativeAuthBasePath,
      passkeyRpId: nativePasskeyRpId,
    }),
  );
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

function getAuthOrigins(passkeyRpId: string) {
  const passkeyRpOrigin = `https://${passkeyRpId}`;
  const passkeyOrigins = [
    ...new Set([urls.web, passkeyRpOrigin, ...androidPasskeyOrigins]),
  ];
  const trustedOrigins = [
    ...new Set(
      env.ENVIRONMENT === "production"
        ? [
            urls.web,
            passkeyRpOrigin,
            ...(desktopBrowserAuthOrigin ? [desktopBrowserAuthOrigin] : []),
            "rodge-mail://",
            ...androidPasskeyOrigins,
          ]
        : [
            urls.web,
            passkeyRpOrigin,
            ...(desktopBrowserAuthOrigin ? [desktopBrowserAuthOrigin] : []),
            "https://*.rodge-mail.local",
            "https://*.www.rodge-mail.local",
            "rodge-mail://",
            ...androidPasskeyOrigins,
          ],
    ),
  ];

  return { passkeyOrigins, trustedOrigins };
}

function getAuthCorsAllowedOrigins(passkeyRpId: string) {
  const passkeyRpOrigin = `https://${passkeyRpId}`;
  return env.ENVIRONMENT === "production"
    ? [
        passkeyRpOrigin,
        ...(desktopBrowserAuthOrigin ? [desktopBrowserAuthOrigin] : []),
      ]
    : [
        passkeyRpOrigin,
        ...(desktopBrowserAuthOrigin ? [desktopBrowserAuthOrigin] : []),
        "*.rodge-mail.local",
        "*.www.rodge-mail.local",
      ];
}

function getDesktopBrowserAuthOrigin() {
  const configured = env.DESKTOP_BROWSER_AUTH_URL?.trim();
  if (!configured) return undefined;
  const url = new URL(configured);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("DESKTOP_BROWSER_AUTH_URL must be an HTTPS origin");
  }
  return url.origin;
}
