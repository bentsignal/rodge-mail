import * as SecureStore from "expo-secure-store";
import { Uniwind } from "uniwind";

export type MobilePalette = "postal";
export type MobileThemeMode = "dark" | "light" | "system";

const PALETTE_KEY = "rodge-mail.palette";
const MODE_KEY = "rodge-mail.theme-mode";

const PALETTES = {
  postal: {
    dark: theme({
      accent: "#3b4d35",
      background: "#0d1c14",
      border: "#42513e",
      brass: "#d0a148",
      brassSoft: "#6a5226",
      card: "#17271d",
      foreground: "#f1e7cf",
      muted: "#223328",
      mutedForeground: "#b9ad94",
      paper: "#26382a",
      paperDeep: "#1c2d22",
      primary: "#d0a148",
      primaryForeground: "#152016",
      ring: "#d0a148",
      shadow: "#020905",
      stamp: "#bd6658",
      well: "#0a1710",
      wellBorder: "#344638",
    }),
    light: theme({
      accent: "#d9c89e",
      background: "#e9dfca",
      border: "#c8b990",
      brass: "#9c6c20",
      brassSoft: "#d5b56c",
      card: "#f5ecd7",
      foreground: "#183224",
      muted: "#ddd1b8",
      mutedForeground: "#716754",
      paper: "#fff5dc",
      paperDeep: "#eee1c5",
      primary: "#8a5d18",
      primaryForeground: "#fff7e6",
      ring: "#9c6c20",
      shadow: "#153021",
      stamp: "#ad5145",
      well: "#d8cbb0",
      wellBorder: "#b8a77e",
    }),
  },
} satisfies Record<MobilePalette, Record<"dark" | "light", ThemeVariables>>;

const currentAppearance = mobileAppearance("postal", "system");
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
    : "postal";
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
  brass: string;
  brassSoft: string;
  card: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  paper: string;
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
    "--accent-foreground": input.foreground,
    "--background": input.background,
    "--border": input.border,
    "--brass": input.brass,
    "--brass-soft": input.brassSoft,
    "--card": input.card,
    "--card-foreground": input.foreground,
    "--foreground": input.foreground,
    "--input": input.border,
    "--muted": input.muted,
    "--muted-foreground": input.mutedForeground,
    "--paper": input.paper,
    "--paper-deep": input.paperDeep,
    "--popover": input.card,
    "--popover-foreground": input.foreground,
    "--primary": input.primary,
    "--primary-foreground": input.primaryForeground,
    "--ring": input.ring,
    "--shadow-color": input.shadow,
    "--stamp": input.stamp,
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
