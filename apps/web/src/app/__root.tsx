import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { convert } from "great-time";

import { createPageTitle } from "@rodge-mail/config/title";
import { cn } from "@rodge-mail/std/cn";
import { Toaster } from "@rodge-mail/ui-web/toast";

import type { RouterContext } from "~/router";
import appStyles from "~/app/styles.css?url";
import { env } from "~/env";
import { getAuth } from "~/features/auth/lib/auth.functions";
import { authClient } from "~/features/auth/lib/client";
import { AuthStore } from "~/features/auth/store";
import { ThemeStore } from "~/features/theme/store";
import { getTheme } from "~/features/theme/utils";

const getThemeFromCookie = createServerFn({ method: "GET" }).handler(() => {
  const themeCookie = getCookie("theme");
  return getTheme(themeCookie);
});

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
    links: [{ rel: "stylesheet", href: appStyles }],
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
        content: "#f3eee4",
        media: "(prefers-color-scheme: light)",
      },
      {
        name: "theme-color",
        content: "#20251f",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const [token, theme] = await Promise.all([
      context.queryClient.fetchQuery({
        queryKey: ["auth-token"],
        queryFn: getAuthToken,
        staleTime: convert(10, "minutes", "to ms"),
        gcTime: Infinity,
      }),
      context.queryClient.fetchQuery({
        queryKey: ["theme"],
        queryFn: async () => await getThemeFromCookie(),
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
      theme,
    };
  },
  component: RootComponent,
});

function RootComponent() {
  const context = Route.useRouteContext({
    select: ({ convex, queryClient, theme, token }) => ({
      convex,
      queryClient,
      theme,
      token,
    }),
  });

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* <ReactScan /> */}
      </head>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
        )}
      >
        <ConvexBetterAuthProvider
          client={context.convex}
          authClient={authClient}
          initialToken={context.token}
        >
          <QueryClientProvider client={context.queryClient}>
            <ThemeStore
              attribute="class"
              defaultTheme="light"
              disableTransitionOnChange
              initialTheme={context.theme}
            >
              <AuthStore>
                <Outlet />
                <TanStackDevtools
                  config={{
                    position: "bottom-right",
                    inspectHotkey: ["Control", "Shift", "I"],
                  }}
                  plugins={[
                    {
                      name: "react-router",
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                  ]}
                />
              </AuthStore>
              <Toaster />
            </ThemeStore>
            <Scripts />
          </QueryClientProvider>
        </ConvexBetterAuthProvider>
      </body>
    </html>
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
