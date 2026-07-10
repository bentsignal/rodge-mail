import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@rodge-mail/ui-web/button";

import { useThemeStore } from "../store";

export function ThemeToggle() {
  const currentTheme = useThemeStore((s) => s.theme);
  const changeTheme = useThemeStore((s) => s.changeTheme);

  if (currentTheme === "light") {
    return (
      <Button
        variant="link"
        onClick={() => changeTheme("dark")}
        className="px-0!"
      >
        <MoonIcon />
        Switch to Dark Mode
      </Button>
    );
  }

  return (
    <Button
      variant="link"
      onClick={() => changeTheme("light")}
      className="px-0!"
    >
      <SunIcon />
      Switch to Light Mode
    </Button>
  );
}
