import * as SecureStore from "expo-secure-store";
import { Uniwind } from "uniwind";

export type MobilePalette = "atlantic" | "evergreen" | "mineral";
export type MobileThemeMode = "dark" | "light" | "system";

const PALETTE_KEY = "rodge-mail.palette";
const MODE_KEY = "rodge-mail.theme-mode";

const PALETTES = {
  evergreen: {
    dark: theme({
      background: "#20251f",
      foreground: "#eee9df",
      card: "#262c26",
      primary: "#df896b",
      primaryForeground: "#20251f",
      muted: "#30362f",
      mutedForeground: "#b7aea2",
      accent: "#3a3b31",
      border: "#41483f",
      ring: "#cf7d61",
    }),
    light: theme({
      background: "#f3eee4",
      foreground: "#293028",
      card: "#fbf8f1",
      primary: "#c76749",
      primaryForeground: "#fff8ee",
      muted: "#e9e1d5",
      mutedForeground: "#776d62",
      accent: "#e8dccb",
      border: "#ddd2c2",
      ring: "#b8664c",
    }),
  },
  atlantic: {
    dark: theme({
      background: "#192634",
      foreground: "#e9eff1",
      card: "#202f3d",
      primary: "#66a8b4",
      primaryForeground: "#162633",
      muted: "#293b49",
      mutedForeground: "#adbec5",
      accent: "#294552",
      border: "#38505e",
      ring: "#66a8b4",
    }),
    light: theme({
      background: "#eef3f5",
      foreground: "#22384b",
      card: "#f8fbfc",
      primary: "#3e8290",
      primaryForeground: "#f5fbfc",
      muted: "#dfe8ec",
      mutedForeground: "#607682",
      accent: "#d8e7e9",
      border: "#cad8de",
      ring: "#4d8d98",
    }),
  },
  mineral: {
    dark: theme({
      background: "#2a2229",
      foreground: "#f0e7e1",
      card: "#332932",
      primary: "#d08365",
      primaryForeground: "#2b2229",
      muted: "#3e323b",
      mutedForeground: "#c1afa8",
      accent: "#49363d",
      border: "#51404b",
      ring: "#c5785d",
    }),
    light: theme({
      background: "#f3ece8",
      foreground: "#3d303b",
      card: "#fcf8f5",
      primary: "#b26448",
      primaryForeground: "#fff8f3",
      muted: "#eadfda",
      mutedForeground: "#786762",
      accent: "#ead9d2",
      border: "#decfc9",
      ring: "#ac654d",
    }),
  },
} satisfies Record<MobilePalette, Record<"dark" | "light", ThemeVariables>>;

const currentAppearance = mobileAppearance("evergreen", "system");
let modePersistence = Promise.resolve();
let palettePersistence = Promise.resolve();

export function getMobileAppearance() {
  return { ...currentAppearance };
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
  currentAppearance.palette = isPalette(storedPalette)
    ? storedPalette
    : "evergreen";
  currentAppearance.mode = isMode(storedMode) ? storedMode : "system";
  applyMobileAppearance();
}

export async function setMobilePalette(palette: MobilePalette) {
  currentAppearance.palette = palette;
  applyMobileAppearance();
  palettePersistence = persistAfter(palettePersistence, PALETTE_KEY, palette);
  await palettePersistence;
}

export async function setMobileThemeMode(mode: MobileThemeMode) {
  currentAppearance.mode = mode;
  Uniwind.setTheme(mode);
  modePersistence = persistAfter(modePersistence, MODE_KEY, mode);
  await modePersistence;
}

function applyMobileAppearance() {
  Uniwind.updateCSSVariables(
    "light",
    PALETTES[currentAppearance.palette].light,
  );
  Uniwind.updateCSSVariables("dark", PALETTES[currentAppearance.palette].dark);
  Uniwind.setTheme(currentAppearance.mode);
}

interface ThemeInput {
  accent: string;
  background: string;
  border: string;
  card: string;
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
    "--accent-foreground": input.foreground,
    "--background": input.background,
    "--border": input.border,
    "--card": input.card,
    "--card-foreground": input.foreground,
    "--foreground": input.foreground,
    "--input": input.border,
    "--muted": input.muted,
    "--muted-foreground": input.mutedForeground,
    "--popover": input.card,
    "--popover-foreground": input.foreground,
    "--primary": input.primary,
    "--primary-foreground": input.primaryForeground,
    "--ring": input.ring,
    "--secondary": input.accent,
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
  return value === "atlantic" || value === "evergreen" || value === "mineral";
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
