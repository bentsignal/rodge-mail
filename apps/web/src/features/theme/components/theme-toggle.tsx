import { MoonIcon, SunIcon } from "lucide-react";

import { useThemeStore } from "../store";

export function ThemeToggle() {
  const currentTheme = useThemeStore((s) => s.theme);
  const changeTheme = useThemeStore((s) => s.changeTheme);

  const nextTheme = currentTheme === "light" ? "dark" : "light";
  const label = currentTheme === "light" ? "Light theme" : "Dark theme";
  const Icon = currentTheme === "light" ? SunIcon : MoonIcon;

  return (
    <button
      aria-label={`Switch to ${nextTheme} theme`}
      className="flex h-10 w-full items-center justify-center gap-2.5 rounded-xl px-3 text-xs text-[#756c63] transition-colors hover:bg-black/[0.04] hover:text-[#20251f] xl:justify-start dark:text-[#aaa195] dark:hover:bg-white/[0.05] dark:hover:text-white"
      onClick={() => changeTheme(nextTheme)}
      title={`Switch to ${nextTheme} theme`}
      type="button"
    >
      <Icon className="size-4" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
