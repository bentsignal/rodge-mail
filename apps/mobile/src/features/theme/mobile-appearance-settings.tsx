import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { MobileThemeMode } from "./mobile-theme";
import { getMobileAppearance, setMobileThemeMode } from "./mobile-theme";

const MOBILE_MODES = [
  { label: "System", mode: "system" },
  { label: "Light", mode: "light" },
  { label: "Dark", mode: "dark" },
] as const satisfies readonly { label: string; mode: MobileThemeMode }[];

export function MobileAppearanceSettings() {
  const [appearance, setAppearance] = useState(getMobileAppearance);

  function selectMode(mode: MobileThemeMode) {
    setAppearance((current) => ({ ...current, mode }));
    void setMobileThemeMode(mode).catch(() => undefined);
  }

  return (
    <View className="gap-3 px-4 py-4">
      <Text className="text-muted-foreground text-sm leading-5">
        Follow your device or keep Rodge Mail in a preferred appearance.
      </Text>
      <View className="bg-well border-well-border flex-row rounded-xl border p-1">
        {MOBILE_MODES.map((option) => {
          const isSelected = appearance.mode === option.mode;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              className={
                isSelected
                  ? "bg-paper border-brass/30 h-9 flex-1 items-center justify-center rounded-lg border"
                  : "h-9 flex-1 items-center justify-center rounded-lg"
              }
              key={option.mode}
              onPress={() => selectMode(option.mode)}
            >
              <Text
                className={
                  isSelected
                    ? "text-foreground text-xs font-semibold"
                    : "text-muted-foreground text-xs font-medium"
                }
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
