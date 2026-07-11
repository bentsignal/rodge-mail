import type { ConvexReactClient } from "convex/react";
// eslint-disable-next-line no-restricted-imports -- Convex requires a stable auth hook and token callback across renders.
import { useCallback, useMemo, useRef, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { ConvexProviderWithAuth } from "convex/react";
import { convert } from "great-time";

import { createPageTitle } from "@rodge-mail/config/title";
import { cn } from "@rodge-mail/std/cn";
import { Toaster } from "@rodge-mail/ui-web/toast";

import type { RouterContext } from "~/router";
import appStyles from "~/app/styles.css?url";
import { env } from "~/env";
import { getAuth } from "~/features/auth/lib/auth.functions";
import { AuthStore } from "~/features/auth/store";
import { ThemeStore } from "~/features/theme/store";
import { getTheme, getThemePalette } from "~/features/theme/utils";

const getAppearanceFromCookie = createServerFn({ method: "GET" }).handler(
  () => {
    return {
      palette: getThemePalette(getCookie("palette")),
      theme: getTheme(getCookie("theme")),
    };
  },
);

async function getAuthToken() {
  try {
    return (await getAuth()) ?? null;
  } catch (error) {
    if (env.VITE_NODE_ENV === "development") return null;
    throw error;
  }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    links: [
      { rel: "stylesheet", href: appStyles },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      {
        rel: "icon",
        href: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        rel: "icon",
        href: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
        sizes: "180x180",
      },
    ],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: createPageTitle() },
      {
        name: "description",
        content: "A calm, focused home for all of your mail.",
      },
      {
        name: "theme-color",
        content: "#d9d1bb",
        media: "(prefers-color-scheme: light)",
      },
      {
        name: "theme-color",
        content: "#09150f",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const [token, appearance] = await Promise.all([
      context.queryClient.fetchQuery({
        queryKey: ["auth-token"],
        queryFn: getAuthToken,
        staleTime: convert(10, "minutes", "to ms"),
        gcTime: Infinity,
      }),
      context.queryClient.fetchQuery({
        queryKey: ["appearance"],
        queryFn: async () => await getAppearanceFromCookie(),
        staleTime: Infinity,
        gcTime: Infinity,
      }),
    ]);

    if (token) {
      context.convexQueryClient.serverHttpClient?.setAuth(token);
      context.convexHttpClient.setAuth(token);
    } else {
      context.convexHttpClient.clearAuth();
    }

    return {
      isAuthenticated: !!token,
      token,
      ...appearance,
    };
  },
  component: RootComponent,
});

function RootComponent() {
  const context = Route.useRouteContext({
    select: ({ convex, palette, queryClient, theme, token }) => ({
      convex,
      palette,
      queryClient,
      theme,
      token,
    }),
  });

  return (
    <html
      className={context.theme === "system" ? undefined : context.theme}
      data-palette={context.palette}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
        {/* <ReactScan /> */}
      </head>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
        )}
      >
        <ServerTokenConvexProvider
          client={context.convex}
          initialToken={context.token}
        >
          <QueryClientProvider client={context.queryClient}>
            <ThemeStore
              attribute="class"
              disableTransitionOnChange
              enableSystem
              initialPalette={context.palette}
              initialTheme={context.theme}
            >
              <AuthStore>
                <Outlet />
              </AuthStore>
              <Toaster />
            </ThemeStore>
            <Scripts />
          </QueryClientProvider>
        </ServerTokenConvexProvider>
      </body>
    </html>
  );
}

function ServerTokenConvexProvider({
  children,
  client,
  initialToken,
}: {
  children: React.ReactNode;
  client: ConvexReactClient;
  initialToken: string | null;
}) {
  const useServerTokenAuth = useMemo(
    () =>
      function useServerTokenAuth() {
        const [token, setToken] = useState(initialToken);
        const pendingToken = useRef<Promise<string | null>>(undefined);

        const fetchAccessToken = useCallback(
          async ({ forceRefreshToken = false } = {}) => {
            if (token && !forceRefreshToken) return token;
            let refresh = pendingToken.current;
            if (!refresh) {
              refresh = getAuthToken().finally(() => {
                pendingToken.current = undefined;
              });
              pendingToken.current = refresh;
            }
            const refreshed = await refresh;
            setToken(refreshed);
            return refreshed;
          },
          [token],
        );

        return useMemo(
          () => ({
            fetchAccessToken,
            isAuthenticated: token !== null,
            isLoading: false,
          }),
          [fetchAccessToken, token],
        );
      },
    [initialToken],
  );

  return (
    <ConvexProviderWithAuth client={client} useAuth={useServerTokenAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}

export function ReactScan() {
  if (env.VITE_NODE_ENV !== "development") {
    return null;
  }
  return (
    <script
      crossOrigin="anonymous"
      src="//unpkg.com/react-scan/dist/auto.global.js"
    />
  );
}
