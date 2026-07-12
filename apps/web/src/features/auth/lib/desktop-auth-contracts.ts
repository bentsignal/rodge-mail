import { z } from "zod";

const desktopAuthToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);

export const desktopAuthRequestSearchSchema = z.object({
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
