import { httpRouter } from "convex/server";

import { authComponent, authCorsAllowedOrigins, createAuth } from "./auth";
import { oauthCallback as gmailOAuthCallback } from "./providers/gmail/http";
import { urls } from "./urls";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: [urls.web, ...authCorsAllowedOrigins],
  },
});

http.route({
  path: "/providers/gmail/oauth/callback",
  method: "GET",
  handler: gmailOAuthCallback,
});

export default http;
