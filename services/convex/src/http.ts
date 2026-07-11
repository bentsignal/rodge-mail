import { httpRouter } from "convex/server";

import { tools as agentTools } from "./agent/http";
import { authComponent, authCorsAllowedOrigins, createAuth } from "./auth";
import { oauthCallback as gmailOAuthCallback } from "./providers/gmail/http";
import { oauthCallback as microsoftOAuthCallback } from "./providers/microsoft/http";
import { urls } from "./urls";

const http = httpRouter();

http.route({
  path: "/agent/v1/tools",
  method: "POST",
  handler: agentTools,
});

authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: [...new Set([urls.web, ...authCorsAllowedOrigins])],
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
