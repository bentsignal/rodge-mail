import type { Theme, ThemePalette } from "./types";

const THEMES = ["system", "light", "dark"] as const satisfies readonly Theme[];
const PALETTES = [
  "evergreen",
  "atlantic",
  "mineral",
] as const satisfies readonly ThemePalette[];

export function getTheme(theme: string | undefined) {
  if (!theme) return "system";
  return THEMES.find((candidate) => candidate === theme) ?? "system";
}

export function resolveThemePreference(
  liveTheme: string | undefined,
  initialTheme: Theme,
) {
  if (liveTheme === undefined) return initialTheme;
  return getTheme(liveTheme);
}

export function getThemePalette(palette: string | undefined) {
  if (!palette) return "evergreen";
  return PALETTES.find((candidate) => candidate === palette) ?? "evergreen";
}
