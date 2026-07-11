import type { ComponentProps, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ImageBackground,
  Platform,
  View,
} from "react-native";

import { useColor } from "~/hooks/use-color";
import paperDark from "../../../../../shared/design-assets/warm-paper/paper-dark.png";
import paperLight from "../../../../../shared/design-assets/warm-paper/paper-light.png";
import paperMuted from "../../../../../shared/design-assets/warm-paper/paper-muted.png";

export function PostalSurface({
  className = "",
  style,
  transparent = false,
  ...props
}: ComponentProps<typeof View> & { transparent?: boolean }) {
  const shadowColor = useColor("shadow-color");

  return (
    <View
      className={`${transparent ? "bg-transparent" : "bg-paper"} border-paper-border rounded-2xl border ${className}`}
      style={[
        {
          elevation: transparent ? 0 : 2,
          shadowColor,
          shadowOffset: { height: 3, width: 0 },
          shadowOpacity: transparent ? 0 : 0.12,
          shadowRadius: 7,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function PostalPaperBackground({
  children,
  className = "",
  muted = false,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  const backgroundColor = useColor(muted ? "paper-deep" : "paper");
  const texture = usePaperTexture(muted);
  const reduceTransparency = useReduceTransparency();

  if (reduceTransparency) {
    return (
      <View className={`flex-1 ${className}`} style={{ backgroundColor }}>
        {children}
      </View>
    );
  }

  return (
    <ImageBackground
      className={`flex-1 ${className}`}
      resizeMode="repeat"
      source={texture}
      style={{ backgroundColor }}
    >
      {children}
    </ImageBackground>
  );
}

export function PostalStamp() {
  const shadowColor = useColor("shadow-color");

  return (
    <View
      accessibilityElementsHidden
      className="bg-paper border-paper-border h-11 w-10 items-center justify-center rounded-md border"
      importantForAccessibility="no-hide-descendants"
      style={{
        elevation: 2,
        shadowColor,
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        transform: [{ rotate: "3deg" }],
      }}
    >
      <View className="bg-stamp h-7 w-6 rounded-sm" />
    </View>
  );
}

export function PostalWell({
  className = "",
  ...props
}: ComponentProps<typeof View>) {
  return (
    <View
      className={`bg-well border-well-border rounded-2xl border ${className}`}
      {...props}
    />
  );
}

function usePaperTexture(muted: boolean) {
  const paper = useColor("paper");
  const isDark = paper.toUpperCase() === "#242720";
  if (isDark) return paperDark;
  return muted ? paperMuted : paperLight;
}

function useReduceTransparency() {
  const [isEnabled, setIsEnabled] = useState(false);

  // eslint-disable-next-line no-restricted-syntax -- AccessibilityInfo exposes Reduce Transparency as an external native event source.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setIsEnabled);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setIsEnabled,
    );
    return () => subscription.remove();
  }, []);

  return isEnabled;
}
