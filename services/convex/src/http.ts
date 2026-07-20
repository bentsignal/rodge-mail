import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import {
  authComponent,
  authCorsAllowedOrigins,
  createAuth,
  createNativeAuth,
  nativeAuthCorsAllowedOrigins,
} from "./auth";
import { oauthCallback as gmailOAuthCallback } from "./providers/gmail/http";
import { oauthCallback as microsoftOAuthCallback } from "./providers/microsoft/http";
import { urls } from "./urls";

const http = httpRouter();

const appleAppSiteAssociation = httpAction(() =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        applinks: { apps: [], details: [] },
        webcredentials: {
          apps: ["39K6A9FP99.com.bentsignal.rodgemail"],
        },
      }),
      {
        headers: {
          "Cache-Control": "public, max-age=3600",
          "Content-Type": "application/json",
        },
      },
    ),
  ),
);

http.route({
  path: "/.well-known/apple-app-site-association",
  method: "GET",
  handler: appleAppSiteAssociation,
});

authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: [...new Set([urls.web, ...authCorsAllowedOrigins])],
  },
});

authComponent.registerRoutes(http, createNativeAuth, {
  cors: {
    allowedOrigins: [...new Set(nativeAuthCorsAllowedOrigins)],
  },
});

http.route({
  path: "/providers/gmail/oauth/callback",
  method: "GET",
  handler: gmailOAuthCallback,
});

http.route({
  path: "/providers/microsoft/oauth/callback",
  method: "GET",
  handler: microsoftOAuthCallback,
});

export default http;
