import { httpRouter } from "convex/server";

import { authComponent, authCorsAllowedOrigins, createAuth } from "./auth";
import { oauthCallback as gmailOAuthCallback } from "./providers/gmail/http";
import {
  acknowledgeSend as acknowledgeICloudSend,
  claimJobs as claimICloudJobs,
  completeConnection as completeICloudConnection,
  ingestSyncBatch as ingestICloudSyncBatch,
} from "./providers/icloud/http";
import { oauthCallback as microsoftOAuthCallback } from "./providers/microsoft/http";
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

http.route({
  path: "/providers/microsoft/oauth/callback",
  method: "GET",
  handler: microsoftOAuthCallback,
});

http.route({
  path: "/providers/icloud/bridge/connections/complete",
  method: "POST",
  handler: completeICloudConnection,
});

http.route({
  path: "/providers/icloud/bridge/jobs/claim",
  method: "POST",
  handler: claimICloudJobs,
});

http.route({
  path: "/providers/icloud/bridge/sync",
  method: "POST",
  handler: ingestICloudSyncBatch,
});

http.route({
  path: "/providers/icloud/bridge/jobs/ack",
  method: "POST",
  handler: acknowledgeICloudSend,
});

export default http;
