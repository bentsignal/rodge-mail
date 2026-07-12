import { createFileRoute } from "@tanstack/react-router";

import { createAuthCallbackHandler } from "~/features/auth/lib/auth-callback";
import { verifyOneTimeToken } from "~/features/auth/lib/auth.server";
import { copyAuthCookies } from "~/features/auth/lib/cookies";

const handleCallback = createAuthCallbackHandler({
  copyAuthCookies,
  verifyOneTimeToken,
});

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleCallback(request),
    },
  },
});
