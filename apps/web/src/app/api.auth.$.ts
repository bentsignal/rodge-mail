import { createFileRoute } from "@tanstack/react-router";

import { handler } from "~/features/auth/lib/auth.server";
import { withAuthCookies } from "~/features/auth/lib/cookies";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => withAuthCookies(await handler(request)),
      POST: async ({ request }) => withAuthCookies(await handler(request)),
    },
  },
});
