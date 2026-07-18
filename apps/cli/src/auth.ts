/* eslint-disable no-restricted-syntax -- HTTP response bodies are unknown until these authentication boundary guards validate them. */
import { createHash, randomBytes } from "node:crypto";

import type { CliSession, CliUrls } from "./config.ts";
import { startAuthCallback } from "./auth-callback.ts";
import { openBrowser } from "./browser.ts";
import { readSession, removeSession, writeSession } from "./config.ts";

const authBasePath = "/api/auth";

export async function login(urls: CliUrls) {
  const requestId = randomToken();
  const verifier = randomToken();
  const callbackRuntime = await startAuthCallback(requestId);
  try {
    await authRequest(urls, "/desktop-auth/begin", {
      codeChallenge: codeChallenge(verifier),
      requestId,
    });
    const browserUrl = new URL("/desktop-auth", urls.web);
    browserUrl.searchParams.set("request_id", requestId);
    browserUrl.searchParams.set("callback_url", callbackRuntime.url);
    openBrowser(browserUrl.href);
    process.stderr.write(`Opening ${browserUrl.origin} to sign in…\n`);
    const callback = await callbackRuntime.callback;
    const response = await authRequest(urls, "/desktop-auth/exchange", {
      authorizationCode: callback.authorizationCode,
      codeVerifier: verifier,
      requestId,
    });
    const cookie = extractSessionCookie(response.headers);
    if (!cookie) throw new Error("Sign-in completed without a CLI session");
    await writeSession({ cookie, createdAt: Date.now() });
  } finally {
    await callbackRuntime.close();
  }
}

export async function logout(urls: CliUrls) {
  const session = await readSession();
  try {
    if (session) {
      await fetch(`${urls.convexSite}${authBasePath}/sign-out`, {
        body: "{}",
        headers: authHeaders(session),
        method: "POST",
      });
    }
  } finally {
    await removeSession();
  }
}

export async function getConvexToken(urls: CliUrls, session: CliSession) {
  const response = await fetch(
    `${urls.convexSite}${authBasePath}/convex/token`,
    { headers: authHeaders(session) },
  );
  if (!response.ok) throw notAuthenticatedError();
  const value: unknown = await response.json();
  if (!isTokenResponse(value)) throw notAuthenticatedError();
  return value.token;
}

export async function authenticatedSession(urls: CliUrls) {
  const session = await readSession();
  if (!session) throw notAuthenticatedError();
  const token = await getConvexToken(urls, session);
  return { session, token };
}

export async function isAuthenticated(urls: CliUrls) {
  try {
    await authenticatedSession(urls);
    return true;
  } catch {
    return false;
  }
}

export function extractSessionCookie(headers: Headers) {
  const values = headers.getSetCookie();
  const cookies = values
    .map((value) => value.split(";", 1)[0])
    .filter((value): value is string => Boolean(value));
  const session = cookies.find((cookie) =>
    cookie.slice(0, cookie.indexOf("=")).endsWith("session_token"),
  );
  return session;
}

function authHeaders(session: CliSession) {
  return {
    Accept: "application/json",
    "better-auth-cookie": session.cookie,
    "Content-Type": "application/json",
  };
}

async function authRequest(
  urls: CliUrls,
  path: string,
  body: Record<string, string>,
) {
  const response = await fetch(`${urls.convexSite}${authBasePath}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await authErrorMessage(response));
  }
  return response;
}

async function authErrorMessage(response: Response) {
  try {
    const body: unknown = await response.json();
    if (body !== null && typeof body === "object" && "message" in body) {
      const message = body.message;
      if (typeof message === "string" && message.trim()) return message;
    }
  } catch {
    // The stable status fallback below is safe to show in the terminal.
  }
  return `Authentication failed (${response.status})`;
}

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function isTokenResponse(value: unknown): value is { token: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    "token" in value &&
    typeof value.token === "string"
  );
}

function notAuthenticatedError() {
  return new Error("Not signed in. Run `rodge auth login` first.");
}
