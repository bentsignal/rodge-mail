import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import * as SystemUI from "expo-system-ui";
import { Roboto_500Medium } from "@expo-google-fonts/roboto/500Medium";
import { useFonts } from "@expo-google-fonts/roboto/useFonts";

import { loadMobileSearchPreference } from "~/features/mail/mobile-search-preference";
import { loadMobileAppearance } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export function useInitApp() {
  const backgroundColor = useColor("background");
  const colorScheme = useColorScheme();
  const [appearanceIsLoaded, setAppearanceIsLoaded] = useState(false);

  // eslint-disable-next-line no-restricted-syntax -- Persisted appearance must be restored before the native splash is hidden.
  useEffect(() => {
    let isMounted = true;
    void Promise.all([loadMobileAppearance(), loadMobileSearchPreference()])
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) setAppearanceIsLoaded(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const [backgroundColorsAreLoaded, setBackgroundColorsAreLoaded] =
    useState(false);
  // eslint-disable-next-line no-restricted-syntax -- Native system background has to follow the restored app appearance.
  useEffect(() => {
    if (!appearanceIsLoaded) return;
    void SystemUI.setBackgroundColorAsync(backgroundColor)
      .catch(() => undefined)
      .finally(() => setBackgroundColorsAreLoaded(true));
  }, [appearanceIsLoaded, backgroundColor, colorScheme]);

  const [fontsAreLoaded] = useFonts({
    Roboto_500Medium,
  });

  return {
    backgroundColorsAreLoaded,
    fontsAreLoaded,
  };
}
