import type { LucideIcon } from "lucide-react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { Theme } from "../types";
import { useThemeStore } from "../store";

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
  const theme = useThemeStore((store) => store.theme);
  const changeTheme = useThemeStore((store) => store.changeTheme);

  return (
    <section aria-labelledby="appearance-heading">
      <div>
        <h2 className="text-sm font-semibold" id="appearance-heading">
          Appearance
        </h2>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          Let Rodge follow your preferred light or dark appearance.
        </p>
      </div>
      <div className="mt-4">
        <p className="mail-label mb-2 font-mono text-[9px] tracking-[0.12em] uppercase">
          Color mode
        </p>
        <div
          aria-label="Color mode"
          className="mail-inset grid grid-cols-3 rounded-[11px] border p-1"
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
        "focus-visible:ring-ring flex h-9 items-center justify-center gap-1.5 rounded-[8px] text-xs outline-none focus-visible:ring-2",
        active
          ? "mail-raised text-foreground border"
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
