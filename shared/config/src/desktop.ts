export const PACKAGED_DESKTOP_USER_AGENT_TOKEN = "RodgeMailDesktop/packaged";

export type DesktopAuthMode = "browser-handoff" | "direct-passkey";

interface ResolveDesktopAuthModeOptions {
  browserAuthUrl?: string;
  currentOrigin: string;
  userAgent: string;
}

export function isDesktopRuntimeUserAgent(userAgent: string) {
  return userAgent.includes("Electron/");
}

export function isPackagedDesktopRuntimeUserAgent(userAgent: string) {
  return (
    isDesktopRuntimeUserAgent(userAgent) &&
    userAgent.includes(PACKAGED_DESKTOP_USER_AGENT_TOKEN)
  );
}

export function resolveDesktopAuthMode({
  browserAuthUrl,
  currentOrigin,
  userAgent,
}: ResolveDesktopAuthModeOptions): DesktopAuthMode {
  if (!isDesktopRuntimeUserAgent(userAgent)) return "direct-passkey";
  if (!isPackagedDesktopRuntimeUserAgent(userAgent)) return "browser-handoff";
  if (!browserAuthUrl) return "direct-passkey";

  try {
    return new URL(browserAuthUrl).origin === new URL(currentOrigin).origin
      ? "direct-passkey"
      : "browser-handoff";
  } catch {
    return "direct-passkey";
  }
}

export function addPackagedDesktopRuntimeUserAgent(userAgent: string) {
  if (userAgent.includes(PACKAGED_DESKTOP_USER_AGENT_TOKEN)) return userAgent;
  return `${userAgent} ${PACKAGED_DESKTOP_USER_AGENT_TOKEN}`;
}
