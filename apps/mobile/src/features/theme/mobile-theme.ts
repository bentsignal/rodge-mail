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
      accent: "#214A36",
      accentForeground: "#F7F0DF",
      background: "#171B17",
      border: "#41453B",
      brass: "#C89A42",
      brassSoft: "#D4A64B",
      card: "#242720",
      foreground: "#F3EBDD",
      forest: "#173C2B",
      forestDeep: "#102C20",
      forestRaised: "#214A36",
      muted: "#2D3029",
      mutedForeground: "#BEB8AA",
      paper: "#242720",
      paperBorder: "#41453B",
      paperDeep: "#2D3029",
      primary: "#C89A42",
      primaryForeground: "#21190C",
      ring: "#C89A42",
      shadow: "#080A08",
      stamp: "#D56A59",
      well: "#2D3029",
      wellBorder: "#41453B",
    }),
    light: theme({
      accent: "#173C2B",
      accentForeground: "#F7F0DF",
      background: "#F5F0E5",
      border: "#D8CFBC",
      brass: "#C99B43",
      brassSoft: "#D2A953",
      card: "#FFFDF6",
      foreground: "#2B2924",
      forest: "#173C2B",
      forestDeep: "#102C20",
      forestRaised: "#214A36",
      muted: "#EEE5D3",
      mutedForeground: "#686158",
      paper: "#FFFDF6",
      paperBorder: "#D8CFBC",
      paperDeep: "#EEE5D3",
      primary: "#C99B43",
      primaryForeground: "#251C0E",
      ring: "#C99B43",
      shadow: "#372F22",
      stamp: "#A83F32",
      well: "#EEE5D3",
      wellBorder: "#D8CFBC",
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
  brass: string;
  brassSoft: string;
  card: string;
  foreground: string;
  forest: string;
  forestDeep: string;
  forestRaised: string;
  muted: string;
  mutedForeground: string;
  paper: string;
  paperBorder: string;
  paperDeep: string;
  primary: string;
  primaryForeground: string;
  ring: string;
  shadow: string;
  stamp: string;
  well: string;
  wellBorder: string;
}

type ThemeVariables = ReturnType<typeof theme>;

function theme(input: ThemeInput) {
  return {
    "--accent": input.accent,
    "--accent-foreground": input.accentForeground,
    "--background": input.background,
    "--border": input.border,
    "--brass": input.brass,
    "--brass-soft": input.brassSoft,
    "--card": input.card,
    "--card-foreground": input.foreground,
    "--foreground": input.foreground,
    "--forest": input.forest,
    "--forest-deep": input.forestDeep,
    "--forest-raised": input.forestRaised,
    "--input": input.border,
    "--muted": input.muted,
    "--muted-foreground": input.mutedForeground,
    "--paper": input.paper,
    "--paper-border": input.paperBorder,
    "--paper-deep": input.paperDeep,
    "--popover": input.card,
    "--popover-foreground": input.foreground,
    "--primary": input.primary,
    "--primary-foreground": input.primaryForeground,
    "--ring": input.ring,
    "--shadow-color": input.shadow,
    "--stamp": input.stamp,
    "--secondary": input.accent,
    "--secondary-foreground": input.accentForeground,
    "--sidebar": input.background,
    "--sidebar-accent": input.muted,
    "--sidebar-accent-foreground": input.foreground,
    "--sidebar-border": input.border,
    "--sidebar-foreground": input.foreground,
    "--sidebar-primary": input.primary,
    "--sidebar-primary-foreground": input.primaryForeground,
    "--sidebar-ring": input.ring,
    "--well": input.well,
    "--well-border": input.wellBorder,
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
