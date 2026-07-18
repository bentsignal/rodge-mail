import { createServer } from "node:http";

const CALLBACK_PATH = "/auth/desktop-complete";
const desktopAuthToken = /^[A-Za-z0-9_-]{43}$/u;

export interface DesktopAuthCallback {
  authorizationCode: string;
  requestId: string;
}

export interface DesktopAuthCallbackRuntime {
  close: () => Promise<void>;
  url: string;
}

export async function startDesktopAuthCallback(
  onCallback: (callback: DesktopAuthCallback) => void,
) {
  const server = createServer((request, response) => {
    const callback = parseDesktopAuthCallback(request.method, request.url);
    if (!callback) {
      response.writeHead(400, responseHeaders("text/plain; charset=utf-8"));
      response.end("Invalid Rodge Mail desktop authentication callback.");
      return;
    }

    response.writeHead(200, responseHeaders("text/html; charset=utf-8"));
    response.end(successPage);
    onCallback(callback);
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
    throw new Error("Desktop authentication callback did not bind a port");
  }
  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
    url: `http://127.0.0.1:${address.port}${CALLBACK_PATH}`,
  };
}

export function parseDesktopAuthCallback(
  method: string | undefined,
  requestUrl: string | undefined,
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
  if (!hasValidCallbackShape(url, authorizationCode, requestId)) {
    return undefined;
  }

  return { authorizationCode, requestId };
}

function hasValidCallbackShape(
  url: URL,
  authorizationCode: string,
  requestId: string,
) {
  return (
    url.pathname === CALLBACK_PATH &&
    !url.hash &&
    url.searchParams.size === 2 &&
    desktopAuthToken.test(authorizationCode) &&
    desktopAuthToken.test(requestId)
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
  <body><main><h1>Sign-in successful</h1><p>You're signed in to Rodge Mail. The desktop app is open, so you can close this tab.</p></main></body>
</html>`;
