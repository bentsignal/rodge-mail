import { StrictMode, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { useConvexAuth } from "convex/react";

import { authClient, convex } from "~/features/auth/client";
import { MailStore } from "~/features/mail/store";
import { useMobileNotifications } from "~/features/notifications/mobile-notifications";
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
  const liquidGlassIsAvailable = isLiquidGlassAvailable();
  const { isAuthenticated } = useConvexAuth();
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
          isAuthenticated
          liquidGlassIsAvailable={liquidGlassIsAvailable}
        />
      </MailStore>
    );
  }

  return (
    <AppNavigation
      backgroundColor={backgroundColor}
      isAuthenticated={false}
      liquidGlassIsAvailable={liquidGlassIsAvailable}
    />
  );
}

function AppNavigation({
  backgroundColor,
  isAuthenticated,
  liquidGlassIsAvailable,
}: {
  backgroundColor: string;
  isAuthenticated: boolean;
  liquidGlassIsAvailable: boolean;
}) {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor },
        }}
      >
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
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
      <StatusBar style={statusBarStyleFor(backgroundColor)} />
    </>
  );
}

function statusBarStyleFor(backgroundColor: string) {
  const color = backgroundColor.replace("#", "");
  const rgb =
    color.length === 6
      ? [
          Number.parseInt(color.slice(0, 2), 16),
          Number.parseInt(color.slice(2, 4), 16),
          Number.parseInt(color.slice(4, 6), 16),
        ]
      : backgroundColor
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number);
  if (rgb?.length !== 3 || rgb.some(Number.isNaN)) return "auto";
  const [red = 0, green = 0, blue = 0] = rgb;
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance < 128 ? "light" : "dark";
}
