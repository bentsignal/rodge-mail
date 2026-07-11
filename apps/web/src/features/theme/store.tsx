import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ThemeProvider as NextThemeProvider,
  useTheme as useNextTheme,
} from "next-themes";
import { createStore } from "rostra";

import type { Theme, ThemePalette } from "./types";

function useInternalStore({
  initialPalette,
  initialTheme,
}: {
  initialPalette: ThemePalette;
  initialTheme: Theme;
}) {
  const queryClient = useQueryClient();
  const { setTheme: setNextTheme } = useNextTheme();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [palette, setPalette] = useState<ThemePalette>(initialPalette);

  // eslint-disable-next-line no-restricted-syntax -- Theme changes must be persisted to a browser cookie.
  useEffect(() => {
    setNextTheme(theme);
    document.cookie = `theme=${theme}; path=/; max-age=${60 * 60 * 24 * 30}`;
  }, [setNextTheme, theme]);

  // eslint-disable-next-line no-restricted-syntax -- Palette changes must be persisted to a browser cookie.
  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    document.cookie = `palette=${palette}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }, [palette]);

  function changeTheme(newTheme: Theme) {
    setNextTheme(newTheme);
    setTheme(newTheme);
    queryClient.setQueryData<{ palette: ThemePalette; theme: Theme }>(
      ["appearance"],
      (current) => ({
        palette: current?.palette ?? palette,
        theme: newTheme,
      }),
    );
  }

  function changePalette(newPalette: ThemePalette) {
    document.documentElement.dataset.palette = newPalette;
    setPalette(newPalette);
    queryClient.setQueryData<{ palette: ThemePalette; theme: Theme }>(
      ["appearance"],
      (current) => ({
        palette: newPalette,
        theme: current?.theme ?? theme,
      }),
    );
  }

  return { changePalette, changeTheme, palette, theme };
}

const { Store: InternalThemeStore, useStore } = createStore(useInternalStore);

function ThemeStore({
  children,
  initialPalette,
  initialTheme,
  ...props
}: React.ComponentProps<typeof NextThemeProvider> & {
  initialPalette: ThemePalette;
  initialTheme: Theme;
}) {
  return (
    <NextThemeProvider {...props} defaultTheme={initialTheme}>
      <InternalThemeStore
        initialPalette={initialPalette}
        initialTheme={initialTheme}
      >
        {children}
      </InternalThemeStore>
    </NextThemeProvider>
  );
}

export { ThemeStore, useStore as useThemeStore };
