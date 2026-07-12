import { getSafeAppRedirect } from "./safe-redirect";

interface AuthCallbackDependencies {
  copyAuthCookies: (from: Response, to: Headers) => void;
  verifyOneTimeToken: (token: string) => Promise<Response>;
}

export function createAuthCallbackHandler({
  copyAuthCookies,
  verifyOneTimeToken,
}: AuthCallbackDependencies) {
  return async function handleAuthCallback(request: Request) {
    const url = new URL(request.url);
    const token = url.searchParams.get("ott");
    const location = getSafeAppRedirect(url.searchParams.get("redirect_uri"));

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
  };
}
