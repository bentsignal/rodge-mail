import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";

import { useColor } from "~/hooks/use-color";

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
}: {
  children: ReactNode;
  className?: string;
}) {
  return <View className={`bg-paper flex-1 ${className}`}>{children}</View>;
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
