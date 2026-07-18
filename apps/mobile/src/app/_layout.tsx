import { StrictMode, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";

import { authClient, convex } from "~/features/auth/client";
import { useStableAuthState } from "~/features/auth/use-stable-auth-state";
import { MailStore } from "~/features/mail/store";
import { useMobileNotifications } from "~/features/notifications/mobile-notifications";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import { useInitApp } from "~/hooks/use-init-app";

import "../styles.css";

SplashScreen.setOptions({ duration: 200, fade: true });
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const readiness = useInitApp();
  const backgroundColor = useColor("background");

  return (
    <GestureHandlerRootView
      className="flex-1"
      style={{ backgroundColor, flex: 1 }}
    >
      <SafeAreaProvider>
        <StrictMode>
          <ConvexBetterAuthProvider authClient={authClient} client={convex}>
            <AppShell readiness={readiness} />
          </ConvexBetterAuthProvider>
        </StrictMode>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppShell({ readiness }: { readiness: ReturnType<typeof useInitApp> }) {
  const backgroundColor = useColor("background");
  const colorScheme = useResolvedMobileColorScheme();
  const liquidGlassIsAvailable = isLiquidGlassAvailable();
  const { isAuthenticated } = useStableAuthState();
  useMobileNotifications(isAuthenticated);

  // eslint-disable-next-line no-restricted-syntax -- Native splash visibility must follow asynchronous font and system-color initialization.
  useEffect(() => {
    if (!readiness.backgroundColorsAreLoaded || !readiness.fontsAreLoaded) {
      return;
    }
    void SplashScreen.hideAsync();
  }, [readiness.backgroundColorsAreLoaded, readiness.fontsAreLoaded]);

  if (!readiness.backgroundColorsAreLoaded || !readiness.fontsAreLoaded) {
    return null;
  }

  if (isAuthenticated) {
    return (
      <MailStore>
        <AppNavigation
          backgroundColor={backgroundColor}
          colorScheme={colorScheme}
          isAuthenticated
          liquidGlassIsAvailable={liquidGlassIsAvailable}
        />
      </MailStore>
    );
  }

  return (
    <AppNavigation
      backgroundColor={backgroundColor}
      colorScheme={colorScheme}
      isAuthenticated={false}
      liquidGlassIsAvailable={liquidGlassIsAvailable}
    />
  );
}

function AppNavigation({
  backgroundColor,
  colorScheme,
  isAuthenticated,
  liquidGlassIsAvailable,
}: {
  backgroundColor: string;
  colorScheme: "dark" | "light";
  isAuthenticated: boolean;
  liquidGlassIsAvailable: boolean;
}) {
  const border = useColor("border");
  const foreground = useColor("foreground");
  const primary = useColor("primary");
  const baseTheme = colorScheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: backgroundColor,
      border,
      card: backgroundColor,
      primary,
      text: foreground,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor },
        }}
      >
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen name="provider-complete" />
          <Stack.Screen
            name="compose"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.92, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 24,
              contentStyle: {
                backgroundColor: liquidGlassIsAvailable
                  ? "transparent"
                  : backgroundColor,
              },
            }}
          />
        </Stack.Protected>
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}
