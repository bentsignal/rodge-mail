import type { CookiesSetDetails } from "electron";

interface EmbeddedRequestCookie {
  name: string;
  value: string;
}

interface EmbeddedCookieStore {
  remove(url: string, name: string): Promise<void>;
  set(details: CookiesSetDetails): Promise<void>;
}

export function createEmbeddedRequestCookieHeader(
  cookies: EmbeddedRequestCookie[],
) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export function createEmbeddedRequestHeaders(
  source: Headers,
  webAppUrl: URL,
  cookies: EmbeddedRequestCookie[],
) {
  const headers = new Headers(source);
  if (!headers.has("origin")) headers.set("origin", webAppUrl.origin);
  headers.set("sec-fetch-site", "same-origin");
  headers.set("x-forwarded-host", webAppUrl.host);
  headers.set("x-forwarded-proto", "https");

  const cookieHeader = createEmbeddedRequestCookieHeader(cookies);
  if (cookieHeader) headers.set("cookie", cookieHeader);
  else headers.delete("cookie");
  return headers;
}

function splitCookies(cookieHeader: string) {
  return cookieHeader.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g).map((cookie) => {
    return cookie.trim();
  });
}

export function readSetCookieHeaders(headers: Headers) {
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) return cookies;

  const cookieHeader = headers.get("set-cookie");
  return cookieHeader ? splitCookies(cookieHeader) : [];
}

function parseCookieAttributes(attributeParts: string[]) {
  const attributes = new Map<string, string>();
  for (const attributePart of attributeParts) {
    const separator = attributePart.indexOf("=");
    const name = attributePart
      .slice(0, separator === -1 ? undefined : separator)
      .trim()
      .toLowerCase();
    const value =
      separator === -1 ? "" : attributePart.slice(separator + 1).trim();
    attributes.set(name, value);
  }
  return attributes;
}

function parseExpiration(attributes: Map<string, string>, now: number) {
  const rawMaxAge = attributes.get("max-age");
  if (rawMaxAge !== undefined) {
    const maxAge = Number(rawMaxAge);
    if (Number.isFinite(maxAge)) {
      return {
        expirationDate: now / 1_000 + maxAge,
        expired: maxAge <= 0,
      };
    }
  }

  const rawExpires = attributes.get("expires");
  const expirationTime = rawExpires ? Date.parse(rawExpires) : Number.NaN;
  if (Number.isNaN(expirationTime)) return { expired: false };

  return {
    expirationDate: expirationTime / 1_000,
    expired: expirationTime <= now,
  };
}

function parseSameSite(value: string | undefined) {
  switch (value?.toLowerCase()) {
    case "lax":
      return "lax";
    case "none":
      return "no_restriction";
    case "strict":
      return "strict";
    case undefined:
      return undefined;
    default:
      return undefined;
  }
}

function createCookieDetails({
  attributes,
  expiration,
  name,
  value,
  webAppUrl,
}: {
  attributes: Map<string, string>;
  expiration: ReturnType<typeof parseExpiration>;
  name: string;
  value: string;
  webAppUrl: URL;
}) {
  const path = attributes.get("path");
  const sameSite = parseSameSite(attributes.get("samesite"));
  return {
    name,
    url: webAppUrl.origin,
    value,
    ...(expiration.expirationDate === undefined
      ? {}
      : { expirationDate: expiration.expirationDate }),
    ...(attributes.has("httponly") ? { httpOnly: true } : {}),
    ...(path?.startsWith("/") ? { path } : { path: "/" }),
    ...(sameSite ? { sameSite } : {}),
    ...(attributes.has("secure") ? { secure: true } : {}),
  } satisfies CookiesSetDetails;
}

export function parseEmbeddedCookie(
  cookieHeader: string,
  webAppUrl: URL,
  now = Date.now(),
) {
  const [nameValue, ...attributeParts] = cookieHeader.split(";");
  const separator = nameValue?.indexOf("=") ?? -1;
  if (!nameValue || separator <= 0) return undefined;

  const name = nameValue.slice(0, separator).trim();
  const value = nameValue.slice(separator + 1).trim();
  if (!name) return undefined;

  const attributes = parseCookieAttributes(attributeParts);
  const expiration = parseExpiration(attributes, now);
  const details = createCookieDetails({
    attributes,
    expiration,
    name,
    value,
    webAppUrl,
  });

  return { details, expired: expiration.expired };
}

export async function synchronizeEmbeddedResponseCookies(
  cookieStore: EmbeddedCookieStore,
  webAppUrl: URL,
  headers: Headers,
) {
  for (const cookieHeader of readSetCookieHeaders(headers)) {
    const parsedCookie = parseEmbeddedCookie(cookieHeader, webAppUrl);
    if (!parsedCookie) continue;

    if (parsedCookie.expired) {
      await cookieStore.remove(webAppUrl.origin, parsedCookie.details.name);
    } else {
      await cookieStore.set(parsedCookie.details);
    }
  }
}
