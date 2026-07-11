import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import type { MobilePalette, MobileThemeMode } from "./mobile-theme";
import {
  getMobileAppearance,
  setMobilePalette,
  setMobileThemeMode,
} from "./mobile-theme";

const MOBILE_PALETTES = [
  {
    label: "Evergreen",
    palette: "evergreen",
    swatches: ["#20251f", "#d9d1c3", "#c76749"],
  },
  {
    label: "Atlantic",
    palette: "atlantic",
    swatches: ["#18304d", "#cfd9df", "#3e8290"],
  },
  {
    label: "Mineral",
    palette: "mineral",
    swatches: ["#402f3d", "#ddd2cc", "#b26448"],
  },
] as const satisfies readonly {
  label: string;
  palette: MobilePalette;
  swatches: readonly [string, string, string];
}[];

const MOBILE_MODES = [
  { label: "System", mode: "system" },
  { label: "Light", mode: "light" },
  { label: "Dark", mode: "dark" },
] as const satisfies readonly { label: string; mode: MobileThemeMode }[];

export function MobileAppearanceSettings() {
  const [appearance, setAppearance] = useState(getMobileAppearance);

  function selectPalette(palette: MobilePalette) {
    setAppearance((current) => ({ ...current, palette }));
    void setMobilePalette(palette).catch(() => undefined);
  }

  function selectMode(mode: MobileThemeMode) {
    setAppearance((current) => ({ ...current, mode }));
    void setMobileThemeMode(mode).catch(() => undefined);
  }

  return (
    <View className="gap-5 px-4 py-4">
      <View className="gap-2.5">
        <Text className="text-muted-foreground text-xs font-medium">
          Palette
        </Text>
        <View className="flex-row gap-2">
          {MOBILE_PALETTES.map((option) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{
                checked: appearance.palette === option.palette,
              }}
              className="bg-card border-border min-w-0 flex-1 gap-2 rounded-xl border p-2.5"
              key={option.palette}
              onPress={() => selectPalette(option.palette)}
            >
              <View className="h-6 flex-row overflow-hidden rounded-md">
                {option.swatches.map((color) => (
                  <View
                    className="flex-1"
                    key={color}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </View>
              <View className="flex-row items-center justify-between gap-1">
                <Text
                  className="text-foreground min-w-0 flex-1 text-xs font-semibold"
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
                <PaletteCheck
                  isSelected={appearance.palette === option.palette}
                />
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <View className="gap-2.5">
        <Text className="text-muted-foreground text-xs font-medium">Mode</Text>
        <View className="bg-background border-border flex-row rounded-xl border p-1">
          {MOBILE_MODES.map((option) => {
            const isSelected = appearance.mode === option.mode;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                className={
                  isSelected
                    ? "bg-card h-9 flex-1 items-center justify-center rounded-lg"
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
    </View>
  );
}

function PaletteCheck({ isSelected }: { isSelected: boolean }) {
  if (!isSelected) return null;
  return <Check className="text-primary" size={14} strokeWidth={3} />;
}
