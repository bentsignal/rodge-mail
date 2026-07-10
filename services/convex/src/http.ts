import { httpRouter } from "convex/server";

import { authComponent, authCorsAllowedOrigins, createAuth } from "./auth";
import { urls } from "./urls";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: [urls.web, ...authCorsAllowedOrigins],
  },
});

export default http;
