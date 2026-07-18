import { createServer } from "node:http";

const callbackPath = "/auth/desktop-complete";
const authToken = /^[A-Za-z0-9_-]{43}$/u;

export interface AuthCallback {
  authorizationCode: string;
  requestId: string;
}

export async function startAuthCallback(
  expectedRequestId: string,
  timeoutMs = 5 * 60 * 1_000,
) {
  let settle: ((callback: AuthCallback) => void) | undefined;
  let rejectCallback: ((error: Error) => void) | undefined;
  const callback = new Promise<AuthCallback>((resolve, reject) => {
    settle = resolve;
    rejectCallback = reject;
  });
  const server = createServer((request, response) => {
    const parsed = parseAuthCallback(
      request.method,
      request.url,
      expectedRequestId,
    );
    if (!parsed) {
      response.writeHead(400, responseHeaders("text/plain; charset=utf-8"));
      response.end("Invalid Rodge Mail authentication callback.");
      return;
    }
    response.writeHead(200, responseHeaders("text/html; charset=utf-8"));
    response.end(successPage);
    settle?.(parsed);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Authentication callback could not bind a local port");
  }
  const timeout = setTimeout(() => {
    rejectCallback?.(new Error("Browser sign-in timed out"));
  }, timeoutMs);
  return {
    callback: callback.finally(() => clearTimeout(timeout)),
    close: async () =>
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
    url: `http://127.0.0.1:${address.port}${callbackPath}`,
  };
}

export function parseAuthCallback(
  method: string | undefined,
  requestUrl: string | undefined,
  expectedRequestId: string,
) {
  if (method !== "GET" || !requestUrl) return undefined;
  let url: URL;
  try {
    url = new URL(requestUrl, "http://127.0.0.1");
  } catch {
    return undefined;
  }
  const authorizationCode = url.searchParams.get("authorization_code");
  const requestId = url.searchParams.get("request_id");
  if (!authorizationCode || !requestId) return undefined;
  if (!hasValidShape(url, authorizationCode, requestId, expectedRequestId))
    return undefined;
  return { authorizationCode, requestId };
}

function hasValidShape(
  url: URL,
  authorizationCode: string,
  requestId: string,
  expectedRequestId: string,
) {
  const hasExpectedLocation =
    url.pathname === callbackPath && url.searchParams.size === 2 && !url.hash;
  const hasExpectedRequest =
    requestId === expectedRequestId && authToken.test(requestId);
  return (
    hasExpectedLocation &&
    hasExpectedRequest &&
    authToken.test(authorizationCode)
  );
}

function responseHeaders(contentType: string) {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };
}

const successPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Rodge Mail sign-in complete</title>
    <style>
      body { background: #e9dfca; color: #183f2a; display: grid; font: 16px system-ui, sans-serif; min-height: 100vh; margin: 0; place-items: center; }
      main { max-width: 32rem; padding: 2rem; text-align: center; }
      h1 { font-family: Georgia, serif; }
    </style>
  </head>
  <body><main><h1>Sign-in successful</h1><p>Return to your terminal. You can close this tab.</p></main></body>
</html>`;
