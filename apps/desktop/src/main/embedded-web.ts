import { dirname, join } from "node:path";
import type { Session, UtilityProcess } from "electron";
import { net, utilityProcess } from "electron";

import {
  isRedirectStatus,
  rewriteEmbeddedRedirect,
} from "./embedded-web-redirects";
import { readEmbeddedWebReadyPort } from "./embedded-web-runtime";
import { createEmbeddedWebEnv } from "./env";

interface EmbeddedWebRuntime {
  active: boolean;
  child: UtilityProcess;
  port: number;
  stopping: boolean;
}

function waitForRuntimeReady(
  runtime: EmbeddedWebRuntime,
  onUnexpectedExit: (error: Error) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("The embedded web runtime did not become ready"));
      runtime.stopping = true;
      runtime.child.kill();
    }, 10_000);

    function cleanupReadyListener() {
      clearTimeout(timeout);
      runtime.child.off("message", handleMessage);
    }

    function handleMessage(message: unknown) {
      const port = readEmbeddedWebReadyPort(message);
      if (!port) return;

      runtime.port = port;
      runtime.active = true;
      cleanupReadyListener();
      resolve();
    }

    function handleExit(code: number) {
      const wasActive = runtime.active;
      runtime.active = false;
      cleanupReadyListener();
      if (runtime.stopping) return;

      const error = new Error(`The embedded web runtime exited (${code})`);
      if (wasActive) onUnexpectedExit(error);
      else reject(error);
    }

    runtime.child.on("message", handleMessage);
    runtime.child.once("exit", handleExit);
  });
}

export async function startEmbeddedWebRuntime(
  onUnexpectedExit: (error: Error) => void,
) {
  const serverEntry = join(process.resourcesPath, "web", "server", "index.mjs");
  const bootstrapEntry = join(
    process.resourcesPath,
    "embedded-web-bootstrap.mjs",
  );
  const child = utilityProcess.fork(bootstrapEntry, [], {
    cwd: dirname(serverEntry),
    env: createEmbeddedWebEnv(serverEntry),
    serviceName: "Rodge Mail Web Runtime",
    stdio: "pipe",
  });
  const runtime = {
    active: false,
    child,
    port: 0,
    stopping: false,
  } satisfies EmbeddedWebRuntime;

  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
  await waitForRuntimeReady(runtime, onUnexpectedExit);
  return runtime;
}

export function routeEmbeddedWebOrigin(
  appSession: Session,
  webAppUrl: URL,
  runtime: EmbeddedWebRuntime,
) {
  const localOrigin = `http://127.0.0.1:${runtime.port}`;
  appSession.protocol.handle("https", async (request) => {
    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== webAppUrl.origin) {
      return await net.fetch(request, { bypassCustomProtocolHandlers: true });
    }
    if (!runtime.active) {
      return new Response("The embedded web runtime is unavailable", {
        headers: { "cache-control": "no-store" },
        status: 503,
        statusText: "Service Unavailable",
      });
    }

    const localUrl = new URL(
      `${requestUrl.pathname}${requestUrl.search}`,
      localOrigin,
    );
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", webAppUrl.host);
    headers.set("x-forwarded-proto", "https");
    const response = await fetch(localUrl.href, {
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      headers,
      method: request.method,
      redirect: "manual",
    });

    const location = response.headers.get("location");
    if (!location || !isRedirectStatus(response.status)) return response;

    const rewrittenLocation = rewriteEmbeddedRedirect(
      location,
      localOrigin,
      webAppUrl,
    );
    if (!rewrittenLocation) {
      return new Response("Blocked an untrusted embedded runtime redirect", {
        headers: { "cache-control": "no-store" },
        status: 502,
        statusText: "Bad Gateway",
      });
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("location", rewrittenLocation);
    return new Response(response.body, {
      headers: responseHeaders,
      status: response.status,
      statusText: response.statusText,
    });
  });
}

export function stopEmbeddedWebRuntime(
  runtime: EmbeddedWebRuntime | undefined,
) {
  if (!runtime) return;
  runtime.active = false;
  runtime.stopping = true;
  if (runtime.child.pid) runtime.child.kill();
}
