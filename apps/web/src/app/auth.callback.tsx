import { createFileRoute } from "@tanstack/react-router";

import { verifyOneTimeToken } from "~/features/auth/lib/auth.server";
import { copyAuthCookies } from "~/features/auth/lib/cookies";

function redirectPath(value: string | null) {
  if (!value?.startsWith("/")) {
    return "/";
  }
  if (value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function handleCallback(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("ott");
  const location = redirectPath(url.searchParams.get("redirect_uri"));

  if (!token) {
    return Response.redirect(new URL("/login", url), 302);
  }

  const verificationResponse = await verifyOneTimeToken(token);
  if (!verificationResponse.ok) {
    return Response.redirect(new URL("/login", url), 302);
  }

  const headers = new Headers({ location });
  copyAuthCookies(verificationResponse, headers);

  return new Response(null, {
    headers,
    status: 302,
  });
}

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleCallback(request),
    },
  },
});
