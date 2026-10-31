import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Uniwind } from "uniwind";

import type { MobileThemeMode } from "./mobile-appearance";
import {
  getMobileThemeUpdateOrder,
  resolveMobileColorScheme,
} from "./mobile-appearance";

export type MobilePalette = "postal";
export type { MobileThemeMode } from "./mobile-appearance";

const PALETTE_KEY = "rodge-mail.palette";
const MODE_KEY = "rodge-mail.theme-mode";

const PALETTES = {
  postal: {
    dark: theme({
      accent: "#2C2C2E",
      accentForeground: "#FFFFFF",
      background: "#000000",
      border: "#38383A",
      card: "#1C1C1E",
      destructive: "#FF453A",
      destructiveForeground: "#FFFFFF",
      foreground: "#FFFFFF",
      muted: "#1C1C1E",
      mutedForeground: "#8E8E93",
      primary: "#FFFFFF",
      primaryForeground: "#000000",
      ring: "#8E8E93",
    }),
    light: theme({
      accent: "#E5E5EA",
      accentForeground: "#000000",
      background: "#FFFFFF",
      border: "#C6C6C8",
      card: "#FFFFFF",
      destructive: "#FF3B30",
      destructiveForeground: "#FFFFFF",
      foreground: "#000000",
      muted: "#F2F2F7",
      mutedForeground: "#6C6C70",
      primary: "#000000",
      primaryForeground: "#FFFFFF",
      ring: "#6C6C70",
    }),
  },
} satisfies Record<MobilePalette, Record<"dark" | "light", ThemeVariables>>;

let currentAppearance = mobileAppearance("postal", "system");
const appearanceListeners = new Set<() => void>();
const systemAppearanceListeners = new Set<() => void>();
let currentSystemColorScheme =
  getConcreteColorScheme(Appearance.getColorScheme()) ?? "light";
let modePersistence = Promise.resolve();
let palettePersistence = Promise.resolve();

Appearance.addChangeListener(({ colorScheme }) => {
  if (currentAppearance.mode !== "system") return;
  const nextColorScheme = getConcreteColorScheme(colorScheme);
  if (!nextColorScheme) return;
  if (nextColorScheme === currentSystemColorScheme) return;
  currentSystemColorScheme = nextColorScheme;
  applyResolvedSystemAppearance(nextColorScheme);
  for (const listener of systemAppearanceListeners) listener();
});

export function getMobileAppearance() {
  return { ...currentAppearance };
}

export function useMobileAppearance() {
  return useSyncExternalStore(
    subscribeToMobileAppearance,
    getMobileAppearanceSnapshot,
    getMobileAppearanceSnapshot,
  );
}

export function useResolvedMobileColorScheme() {
  const { mode } = useMobileAppearance();
  const systemColorScheme = useSyncExternalStore(
    subscribeToSystemAppearance,
    getSystemAppearanceSnapshot,
    getSystemAppearanceSnapshot,
  );
  return resolveMobileColorScheme(mode, systemColorScheme);
}

export async function loadMobileAppearance() {
  const [paletteResult, modeResult] = await Promise.allSettled([
    SecureStore.getItemAsync(PALETTE_KEY),
    SecureStore.getItemAsync(MODE_KEY),
  ]);
  const storedPalette =
    paletteResult.status === "fulfilled" ? paletteResult.value : null;
  const storedMode =
    modeResult.status === "fulfilled" ? modeResult.value : null;
  currentAppearance = mobileAppearance(
    isPalette(storedPalette) ? storedPalette : "postal",
    isMode(storedMode) ? storedMode : "system",
  );
  applyMobileAppearance();
  notifyAppearanceListeners();
}

export async function setMobilePalette(palette: MobilePalette) {
  currentAppearance = { ...currentAppearance, palette };
  applyMobileAppearance();
  notifyAppearanceListeners();
  palettePersistence = persistAfter(palettePersistence, PALETTE_KEY, palette);
  await palettePersistence;
}

export async function setMobileThemeMode(mode: MobileThemeMode) {
  currentAppearance = { ...currentAppearance, mode };
  applyMobileAppearance();
  notifyAppearanceListeners();
  modePersistence = persistAfter(modePersistence, MODE_KEY, mode);
  await modePersistence;
}

function applyMobileAppearance() {
  const resolvedColorScheme = resolveMobileColorScheme(
    currentAppearance.mode,
    currentSystemColorScheme,
  );
  if (currentAppearance.mode === "system") {
    applyResolvedSystemAppearance(resolvedColorScheme);
    return;
  }
  Uniwind.setTheme(resolvedColorScheme);
  applyMobilePaletteVariables(resolvedColorScheme);
}

function applyResolvedSystemAppearance(colorScheme: "dark" | "light") {
  Uniwind.setTheme(colorScheme);
  Appearance.setColorScheme("unspecified");
  applyMobilePaletteVariables(colorScheme);
}

function applyMobilePaletteVariables(activeScheme: "dark" | "light") {
  const [inactiveScheme, resolvedActiveScheme] = getMobileThemeUpdateOrder(
    activeScheme,
    activeScheme,
  );
  Uniwind.updateCSSVariables(
    inactiveScheme,
    PALETTES[currentAppearance.palette][inactiveScheme],
  );
  Uniwind.updateCSSVariables(
    resolvedActiveScheme,
    PALETTES[currentAppearance.palette][resolvedActiveScheme],
  );
}

function getMobileAppearanceSnapshot() {
  return currentAppearance;
}

function subscribeToMobileAppearance(listener: () => void) {
  appearanceListeners.add(listener);
  return () => appearanceListeners.delete(listener);
}

function getSystemAppearanceSnapshot() {
  return currentSystemColorScheme;
}

function subscribeToSystemAppearance(listener: () => void) {
  systemAppearanceListeners.add(listener);
  return () => systemAppearanceListeners.delete(listener);
}

function notifyAppearanceListeners() {
  for (const listener of appearanceListeners) listener();
}

function getConcreteColorScheme(colorScheme: string | null | undefined) {
  if (colorScheme === "dark" || colorScheme === "light") return colorScheme;
  return undefined;
}

interface ThemeInput {
  accent: string;
  accentForeground: string;
  background: string;
  border: string;
  card: string;
  destructive: string;
  destructiveForeground: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  ring: string;
}

type ThemeVariables = ReturnType<typeof theme>;

function theme(input: ThemeInput) {
  return {
    "--accent": input.accent,
    "--accent-foreground": input.accentForeground,
    "--background": input.background,
    "--border": input.border,
    "--card": input.card,
    "--card-foreground": input.foreground,
    "--destructive": input.destructive,
    "--destructive-foreground": input.destructiveForeground,
    "--foreground": input.foreground,
    "--input": input.border,
    "--muted": input.muted,
    "--muted-foreground": input.mutedForeground,
    "--popover": input.card,
    "--popover-foreground": input.foreground,
    "--primary": input.primary,
    "--primary-foreground": input.primaryForeground,
    "--ring": input.ring,
    "--secondary": input.muted,
    "--secondary-foreground": input.foreground,
    "--sidebar": input.background,
    "--sidebar-accent": input.muted,
    "--sidebar-accent-foreground": input.foreground,
    "--sidebar-border": input.border,
    "--sidebar-foreground": input.foreground,
    "--sidebar-primary": input.primary,
    "--sidebar-primary-foreground": input.primaryForeground,
    "--sidebar-ring": input.ring,
  };
}

function isPalette(value: string | null): value is MobilePalette {
  return value === "postal";
}

function isMode(value: string | null): value is MobileThemeMode {
  return value === "dark" || value === "light" || value === "system";
}

function mobileAppearance(palette: MobilePalette, mode: MobileThemeMode) {
  return { mode, palette };
}

function persistAfter(previous: Promise<void>, key: string, value: string) {
  return previous
    .catch(() => undefined)
    .then(async () => await SecureStore.setItemAsync(key, value));
}
