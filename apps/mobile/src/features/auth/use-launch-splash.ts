import { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";

export const AUTH_SPLASH_LIMIT_MS = 3000;

export function shouldHoldSplash({
  appIsReady,
  authIsLoading,
  authWaitExpired,
}: {
  appIsReady: boolean;
  authIsLoading: boolean;
  authWaitExpired: boolean;
}) {
  return !appIsReady || (authIsLoading && !authWaitExpired);
}

/**
 * Keeps the native splash up until the first real screen is known. A
 * session check that runs past AUTH_SPLASH_LIMIT_MS (offline, a slow
 * network) lets it go to the same blank background, which stays until the
 * session is known.
 */
export function useLaunchSplash({
  appIsReady,
  authIsLoading,
}: {
  appIsReady: boolean;
  authIsLoading: boolean;
}) {
  const [authWaitExpired, setAuthWaitExpired] = useState(false);

  // eslint-disable-next-line no-restricted-syntax -- A slow or offline session check must not hold the native splash forever.
  useEffect(() => {
    if (!authIsLoading) return;
    const timeout = setTimeout(
      () => setAuthWaitExpired(true),
      AUTH_SPLASH_LIMIT_MS,
    );
    return () => clearTimeout(timeout);
  }, [authIsLoading]);

  const holdSplash = shouldHoldSplash({
    appIsReady,
    authIsLoading,
    authWaitExpired,
  });

  // eslint-disable-next-line no-restricted-syntax -- Native splash visibility follows asynchronous font, system-color, and session initialization.
  useEffect(() => {
    if (!holdSplash) void SplashScreen.hideAsync();
  }, [holdSplash]);
}
