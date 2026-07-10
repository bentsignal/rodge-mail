import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ThemeProvider as NextThemeProvider,
  useTheme as useNextTheme,
} from "next-themes";
import { createStore } from "rostra";

import type { Theme } from "./types";

function useInternalStore({ initialTheme }: { initialTheme: Theme }) {
  const queryClient = useQueryClient();
  const { setTheme: setNextTheme } = useNextTheme();
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // eslint-disable-next-line no-restricted-syntax -- Theme changes must be persisted to a browser cookie.
  useEffect(() => {
    document.cookie = `theme=${theme}; path=/; max-age=${60 * 60 * 24 * 30}`;
  }, [theme]);

  function changeTheme(newTheme: Theme) {
    setNextTheme(newTheme);
    setTheme(newTheme);
    queryClient.setQueryData(["theme"], newTheme);
  }

  return { theme, changeTheme };
}

const { Store: InternalThemeStore, useStore } = createStore(useInternalStore);

function ThemeStore({
  children,
  initialTheme,
  ...props
}: React.ComponentProps<typeof NextThemeProvider> & { initialTheme: Theme }) {
  return (
    <NextThemeProvider {...props}>
      <InternalThemeStore initialTheme={initialTheme}>
        {children}
      </InternalThemeStore>
    </NextThemeProvider>
  );
}

export { ThemeStore, useStore as useThemeStore };
