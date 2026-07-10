import type { Theme } from "./types";

const THEMES = ["light", "dark"] as const satisfies readonly Theme[];

export function getTheme(theme: string | undefined) {
  if (!theme) return "dark";
  return THEMES.find((candidate) => candidate === theme) ?? "dark";
}
