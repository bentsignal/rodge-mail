export type MobileThemeMode = "dark" | "light" | "system";

export function resolveMobileColorScheme(
  mode: MobileThemeMode,
  systemColorScheme: string | null | undefined,
) {
  if (mode !== "system") return mode;
  return systemColorScheme === "dark" ? "dark" : "light";
}

export function getMobileThemeUpdateOrder(
  mode: MobileThemeMode,
  systemColorScheme: string | null | undefined,
) {
  const activeScheme = resolveMobileColorScheme(mode, systemColorScheme);
  const inactiveScheme = activeScheme === "light" ? "dark" : "light";
  return [inactiveScheme, activeScheme] as const;
}
