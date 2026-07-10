import type { AuthConfig } from "convex/server";
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";

import { sharedAuthIssuer, sharedAuthJwksUri } from "@rodge-mail/config/auth";

import { env } from "./convex.env";

const usesOwnAuthProvider = env.ENVIRONMENT === "production";
const trustsSharedDevelopmentAuth =
  env.ENVIRONMENT === "development" && !usesOwnAuthProvider;

const sharedDevelopmentAuthProviders = (
  sharedAuthIssuer && sharedAuthJwksUri
    ? [
        {
          type: "customJwt",
          issuer: sharedAuthIssuer,
          applicationID: "convex",
          algorithm: "RS256",
          jwks: sharedAuthJwksUri,
        },
      ]
    : []
) satisfies AuthConfig["providers"];

// Used by BetterAuth's convex() plugin — only the primary provider
export const primaryAuthConfig = {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;

// Used by Convex's auth system — includes worktree trust for non-main deployments
export default {
  providers: [
    getAuthConfigProvider(),
    ...(trustsSharedDevelopmentAuth ? sharedDevelopmentAuthProviders : []),
  ],
} satisfies AuthConfig;
