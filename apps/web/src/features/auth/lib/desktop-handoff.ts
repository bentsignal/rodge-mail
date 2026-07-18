import { z } from "zod";

import {
  isDesktopRuntimeUserAgent,
  resolveDesktopAuthMode,
} from "@rodge-mail/config/desktop";
import { completeAuthSession } from "@rodge-mail/std/auth-session";

import { env } from "~/env";
import { authClient } from "./client";
import { createDesktopAuthDeepLink } from "./desktop-auth-contracts";

const pendingDesktopAuthKey = "rodge-mail:desktop-auth";
const tokenByteLength = 32;
const desktopExchangePromises = new Map<string, Promise<void>>();
const pendingDesktopAuthSchema = z.object({
  expiresAt: z.number(),
  requestId: z.string(),
  verifier: z.string(),
});

export interface PendingDesktopAuth {
  expiresAt: number;
  requestId: string;
  verifier: string;
}

export function isDesktopRuntime() {
  return (
    typeof navigator !== "undefined" &&
    isDesktopRuntimeUserAgent(navigator.userAgent)
  );
}

export function usesDesktopBrowserAuth() {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  return (
    resolveDesktopAuthMode({
      userAgent: navigator.userAgent,
    }) === "browser-handoff"
  );
}

export async function beginDesktopAuth() {
  const requestId = createRandomToken();
  const verifier = createRandomToken();
  const codeChallenge = await createCodeChallenge(verifier);
  const result = await authClient.$fetch<{ expiresAt: string }>(
    "/desktop-auth/begin",
    {
      body: { codeChallenge, requestId },
      method: "POST",
    },
  );
  if (result.error) {
    throw new Error(result.error.message ?? "Could not start desktop sign-in");
  }

  const pending = {
    expiresAt: new Date(result.data.expiresAt).getTime(),
    requestId,
    verifier,
  } satisfies PendingDesktopAuth;
  sessionStorage.setItem(pendingDesktopAuthKey, JSON.stringify(pending));

  const browserUrl = new URL("/desktop-auth", getDesktopBrowserAuthOrigin());
  browserUrl.searchParams.set("request_id", requestId);
  const callbackUrl = getDesktopAuthCallbackUrl();
  if (callbackUrl) browserUrl.searchParams.set("callback_url", callbackUrl);
  window.open(browserUrl, "_blank", "noopener,noreferrer");
  return pending;
}

export async function authorizeDesktopAuth(requestId: string) {
  const result = await authClient.$fetch<{ authorizationCode: string }>(
    "/desktop-auth/authorize",
    { body: { requestId }, method: "POST" },
  );
  if (result.error) {
    throw new Error(result.error.message ?? "Desktop sign-in expired");
  }
  return result.data.authorizationCode;
}

export function exchangeDesktopAuth(
  requestId: string,
  authorizationCode: string,
) {
  const exchangeKey = `${requestId}:${authorizationCode}`;
  const existing = desktopExchangePromises.get(exchangeKey);
  if (existing) return existing;

  const exchange = performDesktopAuthExchange(requestId, authorizationCode);
  desktopExchangePromises.set(exchangeKey, exchange);
  return exchange;
}

async function performDesktopAuthExchange(
  requestId: string,
  authorizationCode: string,
) {
  const pending = readPendingDesktopAuth();
  if (!(pending?.requestId === requestId && pending.expiresAt > Date.now())) {
    clearPendingDesktopAuth();
    throw new Error("Desktop sign-in expired. Start again.");
  }

  try {
    await completeAuthSession({
      authenticate: async () =>
        await authClient.$fetch<{ success: boolean }>(
          "/desktop-auth/exchange",
          {
            body: {
              authorizationCode,
              codeVerifier: pending.verifier,
              requestId,
            },
            method: "POST",
          },
        ),
      confirmSession: async () => await authClient.getSession(),
      fallbackMessage: "Desktop sign-in expired",
      refreshSession: () => authClient.$store.notify("$sessionSignal"),
    });
  } catch (error) {
    clearPendingDesktopAuth();
    throw error;
  }
  clearPendingDesktopAuth();
}

export async function cancelDesktopAuth() {
  const pending = readPendingDesktopAuth();
  clearPendingDesktopAuth();
  if (!pending) return;

  await authClient.$fetch("/desktop-auth/cancel", {
    body: {
      codeVerifier: pending.verifier,
      requestId: pending.requestId,
    },
    method: "POST",
  });
}

export function readPendingDesktopAuth() {
  if (typeof sessionStorage === "undefined") return undefined;
  const serialized = sessionStorage.getItem(pendingDesktopAuthKey);
  if (!serialized) return undefined;
  try {
    const parsed = pendingDesktopAuthSchema.safeParse(JSON.parse(serialized));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function clearPendingDesktopAuth() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(pendingDesktopAuthKey);
}

export function createDesktopDeepLink(
  requestId: string,
  authorizationCode: string,
) {
  return createDesktopAuthDeepLink(requestId, authorizationCode);
}

function getDesktopAuthCallbackUrl() {
  return document.documentElement.dataset.desktopAuthCallbackUrl;
}

function getDesktopBrowserAuthOrigin() {
  const configured = env.VITE_DESKTOP_BROWSER_AUTH_URL;
  if (!configured) return window.location.origin;
  const url = new URL(configured);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Desktop browser auth URL must be an HTTPS origin");
  }
  return url.origin;
}

function createRandomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(tokenByteLength));
  return bytesToBase64Url(bytes);
}

async function createCodeChallenge(verifier: string) {
  const input = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}
