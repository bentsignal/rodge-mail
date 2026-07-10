import {
  APP_PROTOCOL,
  DEFAULT_DEV_WEB_URL,
  PRODUCTION_WEB_URL,
} from "./constants";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);
const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

interface ResolveWebAppUrlOptions {
  configuredUrl?: string;
  isPackaged: boolean;
}

function usesSafeDevelopmentProtocol(url: URL) {
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname))
  );
}

function validateProtocol(url: URL, isPackaged: boolean) {
  if (isPackaged && url.protocol !== "https:") {
    throw new Error("RODGE_WEB_URL must use HTTPS in packaged builds");
  }
  if (!isPackaged && !usesSafeDevelopmentProtocol(url)) {
    throw new Error("Development web URLs must use HTTPS or loopback HTTP");
  }
}

function validateOrigin(url: URL) {
  if (url.username || url.password) {
    throw new Error("RODGE_WEB_URL must not contain credentials");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("RODGE_WEB_URL must contain only an origin");
  }
}

export function resolveWebAppUrl(options: ResolveWebAppUrlOptions) {
  const configuredUrl = options.configuredUrl?.trim();
  const rawUrl = options.isPackaged
    ? PRODUCTION_WEB_URL
    : (configuredUrl ?? DEFAULT_DEV_WEB_URL);
  const url = new URL(rawUrl);
  validateProtocol(url, options.isPackaged);
  validateOrigin(url);

  return new URL(url.origin);
}

export function hasSameOrigin(candidate: string, webAppUrl: URL) {
  try {
    return new URL(candidate).origin === webAppUrl.origin;
  } catch {
    return false;
  }
}

export function isSafeExternalUrl(candidate: string) {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(candidate).protocol);
  } catch {
    return false;
  }
}

export function translateDeepLink(candidate: string, webAppUrl: URL) {
  let deepLink: URL;
  try {
    deepLink = new URL(candidate);
  } catch {
    return null;
  }

  if (
    deepLink.protocol !== `${APP_PROTOCOL}:` ||
    deepLink.username ||
    deepLink.password ||
    deepLink.port
  ) {
    return null;
  }

  const hostPath = deepLink.hostname ? `/${deepLink.hostname}` : "";
  const pathname = `${hostPath}${deepLink.pathname}` || "/";
  const destination = new URL(pathname, webAppUrl);
  destination.search = deepLink.search;
  destination.hash = deepLink.hash;

  return destination.origin === webAppUrl.origin ? destination : null;
}
