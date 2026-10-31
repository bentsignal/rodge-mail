import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

import { env } from "./convex.env";
import { DEV_USER_EMAIL, isDevToolsDeployment } from "./devToolsPolicy";

/**
 * True only on an isolated agent backend (`scripts/backend.sh isolate`):
 * `DEV_TOOLS` is "true", which production never sets, and the deployment
 * isn't the production one.
 */
export function devToolsEnabled() {
  return isDevToolsDeployment({
    // Not in convex.env.ts: Convex makes every variable the auth config
    // reads mandatory, and production never sets this one.
    devTools: process.env.DEV_TOOLS,
    environment: env.ENVIRONMENT,
    cloudUrl: env.CONVEX_CLOUD_URL,
    siteUrl: env.CONVEX_SITE_URL,
  });
}

export function requireDevTools() {
  if (!devToolsEnabled()) {
    throw new Error("Dev tools are off on this deployment");
  }
}

/**
 * Isolated backends only: signs the simulator in as the deployment's test
 * owner without a passkey or an email code. Installed only when
 * `devToolsEnabled()`, so production has no such route.
 */
export function devSignIn() {
  return {
    id: "rodge-dev-sign-in",
    endpoints: {
      devSignIn: createAuthEndpoint(
        "/dev/sign-in",
        { method: "POST" },
        async (ctx) => {
          if (!devToolsEnabled()) throw new APIError("NOT_FOUND");
          const found =
            await ctx.context.internalAdapter.findUserByEmail(DEV_USER_EMAIL);
          if (!found || found.user.id !== env.AUTH_ALLOWED_USER_ID) {
            throw new APIError("FORBIDDEN", {
              message:
                "Run scripts/backend.sh isolate to create the test owner",
            });
          }
          const session = await ctx.context.internalAdapter.createSession(
            found.user.id,
          );
          await setSessionCookie(ctx, { session, user: found.user });
          return ctx.json({ email: found.user.email });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
