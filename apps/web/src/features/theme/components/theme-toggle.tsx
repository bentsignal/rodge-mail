import type { LucideIcon } from "lucide-react";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { Theme, ThemePalette } from "../types";
import { useThemeStore } from "../store";

const PALETTE_OPTIONS = [
  {
    description: "Paper, moss, terracotta",
    label: "Evergreen",
    palette: "evergreen",
    swatches: ["#20251f", "#d9d1c3", "#c76749"],
  },
  {
    description: "Ink, slate, sea glass",
    label: "Atlantic",
    palette: "atlantic",
    swatches: ["#18304d", "#cfd9df", "#3e8290"],
  },
  {
    description: "Aubergine, stone, copper",
    label: "Mineral",
    palette: "mineral",
    swatches: ["#402f3d", "#ddd2cc", "#b26448"],
  },
] as const satisfies readonly {
  description: string;
  label: string;
  palette: ThemePalette;
  swatches: readonly [string, string, string];
}[];

const MODE_OPTIONS = [
  { icon: Monitor, label: "System", theme: "system" },
  { icon: Sun, label: "Light", theme: "light" },
  { icon: Moon, label: "Dark", theme: "dark" },
] as const satisfies readonly {
  icon: LucideIcon;
  label: string;
  theme: Theme;
}[];

export function AppearanceSettings() {
  const palette = useThemeStore((store) => store.palette);
  const theme = useThemeStore((store) => store.theme);
  const changePalette = useThemeStore((store) => store.changePalette);
  const changeTheme = useThemeStore((store) => store.changeTheme);

  return (
    <section aria-labelledby="appearance-heading">
      <div>
        <h2 className="text-sm font-semibold" id="appearance-heading">
          Appearance
        </h2>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          Choose a palette, then let Rodge follow your preferred color mode.
        </p>
      </div>
      <div
        aria-label="Color palette"
        className="mt-4 grid grid-cols-3 gap-2"
        role="radiogroup"
      >
        {PALETTE_OPTIONS.map((option) => (
          <PaletteOption
            active={palette === option.palette}
            key={option.palette}
            onSelect={() => changePalette(option.palette)}
            option={option}
          />
        ))}
      </div>
      <div className="mt-5">
        <p className="text-muted-foreground mb-2 font-mono text-[9px] tracking-[0.12em] uppercase">
          Color mode
        </p>
        <div
          aria-label="Color mode"
          className="bg-muted grid grid-cols-3 rounded-xl p-1"
          role="radiogroup"
        >
          {MODE_OPTIONS.map((option) => (
            <ModeOption
              active={theme === option.theme}
              key={option.theme}
              onSelect={() => changeTheme(option.theme)}
              option={option}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PaletteOption({
  active,
  onSelect,
  option,
}: {
  active: boolean;
  onSelect: () => void;
  option: (typeof PALETTE_OPTIONS)[number];
}) {
  return (
    <button
      aria-checked={active}
      className={cn(
        "focus-visible:ring-ring relative min-w-0 rounded-xl border p-2.5 text-left outline-none focus-visible:ring-2",
        active
          ? "border-foreground/30 bg-background shadow-sm"
          : "border-border bg-background/45 hover:bg-background/80",
      )}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <PaletteCheck active={active} />
      <span className="flex h-7 overflow-hidden rounded-lg border border-black/5">
        {option.swatches.map((swatch) => (
          <span
            className="flex-1"
            key={swatch}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </span>
      <span className="mt-2 block truncate text-xs font-semibold">
        {option.label}
      </span>
      <span className="text-muted-foreground mt-0.5 block text-[9px] leading-3">
        {option.description}
      </span>
    </button>
  );
}

function PaletteCheck({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="bg-foreground text-background absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full">
      <Check className="size-2.5" strokeWidth={3} />
    </span>
  );
}

function ModeOption({
  active,
  onSelect,
  option,
}: {
  active: boolean;
  onSelect: () => void;
  option: (typeof MODE_OPTIONS)[number];
}) {
  const Icon = option.icon;
  return (
    <button
      aria-checked={active}
      className={cn(
        "focus-visible:ring-ring flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs outline-none focus-visible:ring-2",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <Icon className="size-3.5" />
      {option.label}
    </button>
  );
}
