import { z } from "zod";

const desktopAuthToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const desktopAuthCallbackUrl = z.url().refine((candidate) => {
  const url = new URL(candidate);
  return (
    url.protocol === "http:" &&
    url.hostname === "127.0.0.1" &&
    Boolean(url.port) &&
    url.pathname === "/auth/desktop-complete" &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password
  );
}, "Desktop callback must be a loopback URL");

export const desktopAuthRequestSearchSchema = z.object({
  callback_url: desktopAuthCallbackUrl.optional(),
  request_id: desktopAuthToken,
});

export const desktopAuthCompleteSearchSchema = z.object({
  authorization_code: desktopAuthToken,
  request_id: desktopAuthToken,
});

export function createDesktopAuthDeepLink(
  requestId: string,
  authorizationCode: string,
) {
  const parameters = desktopAuthCompleteSearchSchema.parse({
    authorization_code: authorizationCode,
    request_id: requestId,
  });
  const url = new URL("rodge-mail://auth/desktop-complete");
  url.searchParams.set("authorization_code", parameters.authorization_code);
  url.searchParams.set("request_id", parameters.request_id);
  return url.href;
}

export function createDesktopAuthCallbackUrl(
  callbackUrl: string,
  requestId: string,
  authorizationCode: string,
) {
  const baseUrl = desktopAuthCallbackUrl.parse(callbackUrl);
  const parameters = desktopAuthCompleteSearchSchema.parse({
    authorization_code: authorizationCode,
    request_id: requestId,
  });
  const url = new URL(baseUrl);
  url.searchParams.set("authorization_code", parameters.authorization_code);
  url.searchParams.set("request_id", parameters.request_id);
  return url.href;
}
