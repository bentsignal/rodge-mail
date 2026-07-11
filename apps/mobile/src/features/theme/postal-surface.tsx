import type { ComponentProps } from "react";
import { View } from "react-native";

import { useColor } from "~/hooks/use-color";

export function PostalSurface({
  className = "",
  style,
  ...props
}: ComponentProps<typeof View>) {
  const shadowColor = useColor("shadow-color");

  return (
    <View
      className={`bg-card border-brass/35 rounded-3xl border ${className}`}
      style={[
        {
          elevation: 3,
          shadowColor,
          shadowOffset: { height: 4, width: 0 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
        },
        style,
      ]}
      {...props}
    />
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
