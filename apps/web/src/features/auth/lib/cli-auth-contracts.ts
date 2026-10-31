import { z } from "zod";

const cliAuthToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const cliAuthCallbackUrl = z.url().refine((candidate) => {
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
}, "CLI callback must be a loopback URL");

export const cliAuthRequestSearchSchema = z.object({
  callback_url: cliAuthCallbackUrl,
  request_id: cliAuthToken,
});

const cliAuthCompleteSchema = z.object({
  authorization_code: cliAuthToken,
  request_id: cliAuthToken,
});

export function createCliAuthCallbackUrl(
  callbackUrl: string,
  requestId: string,
  authorizationCode: string,
) {
  const baseUrl = cliAuthCallbackUrl.parse(callbackUrl);
  const parameters = cliAuthCompleteSchema.parse({
    authorization_code: authorizationCode,
    request_id: requestId,
  });
  const url = new URL(baseUrl);
  url.searchParams.set("authorization_code", parameters.authorization_code);
  url.searchParams.set("request_id", parameters.request_id);
  return url.href;
}
