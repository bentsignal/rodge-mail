const SET_BETTER_AUTH_COOKIE = "set-better-auth-cookie";
const SET_COOKIE = "set-cookie";

function splitCookies(cookieHeader: string) {
  return cookieHeader.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g).map((cookie) => {
    return cookie.trim();
  });
}

export function copyAuthCookies(from: Response, to: Headers) {
  const authCookieHeader = from.headers.get(SET_BETTER_AUTH_COOKIE);
  if (!authCookieHeader) {
    return;
  }

  for (const cookie of splitCookies(authCookieHeader)) {
    to.append(SET_COOKIE, cookie);
  }
}

export function withAuthCookies(response: Response) {
  const headers = new Headers(response.headers);
  copyAuthCookies(response, headers);
  headers.delete(SET_BETTER_AUTH_COOKIE);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
