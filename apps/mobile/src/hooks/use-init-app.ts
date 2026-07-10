import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import * as SystemUI from "expo-system-ui";
import { Roboto_500Medium } from "@expo-google-fonts/roboto/500Medium";
import { useFonts } from "@expo-google-fonts/roboto/useFonts";

import { useColor } from "~/hooks/use-color";

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export function useInitApp() {
  const backgroundColor = useColor("background");
  const colorScheme = useColorScheme();

  const [backgroundColorsAreLoaded, setBackgroundColorsAreLoaded] =
    useState(false);
  // eslint-disable-next-line no-restricted-syntax -- Native system background has to be initialized after color resolution.
  useEffect(() => {
    async function init() {
      await SystemUI.setBackgroundColorAsync(backgroundColor);
      setBackgroundColorsAreLoaded(true);
    }
    void init();
  }, [backgroundColor, backgroundColorsAreLoaded, colorScheme]);

  // eslint-disable-next-line no-restricted-syntax -- Native system background follows color-scheme changes.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(backgroundColor);
  }, [backgroundColor, colorScheme]);

  const [fontsAreLoaded] = useFonts({
    Roboto_500Medium,
  });

  return {
    backgroundColorsAreLoaded,
    fontsAreLoaded,
  };
}
