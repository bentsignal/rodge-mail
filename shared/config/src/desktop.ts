export type DesktopAuthMode = "browser-handoff" | "direct-passkey";

interface ResolveDesktopAuthModeOptions {
  userAgent: string;
}

export function isDesktopRuntimeUserAgent(userAgent: string) {
  return userAgent.includes("Electron/");
}

export function resolveDesktopAuthMode({
  userAgent,
}: ResolveDesktopAuthModeOptions): DesktopAuthMode {
  return isDesktopRuntimeUserAgent(userAgent)
    ? "browser-handoff"
    : "direct-passkey";
}
