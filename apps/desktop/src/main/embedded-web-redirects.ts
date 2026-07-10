const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function isRedirectStatus(status: number) {
  return REDIRECT_STATUSES.has(status);
}

export function rewriteEmbeddedRedirect(
  location: string,
  localOrigin: string,
  webAppUrl: URL,
) {
  let destination: URL;
  try {
    destination = new URL(location, localOrigin);
  } catch {
    return null;
  }

  if (destination.username || destination.password) return null;
  if (destination.origin === webAppUrl.origin) return destination.href;
  if (destination.origin !== localOrigin) return null;

  const rewritten = new URL(
    `${destination.pathname}${destination.search}${destination.hash}`,
    webAppUrl,
  );
  return rewritten.href;
}
