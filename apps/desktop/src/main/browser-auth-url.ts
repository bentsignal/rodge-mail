export function isDesktopBrowserAuthUrl(candidate: string, webAppUrl: URL) {
  try {
    const url = new URL(candidate);
    return (
      url.origin === webAppUrl.origin &&
      url.pathname === "/desktop-auth" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
