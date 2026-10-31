import type { ComponentProps } from "react";
import { View } from "react-native";

export function PostalSurface({
  className = "",
  style,
  transparent = false,
  ...props
}: ComponentProps<typeof View> & { transparent?: boolean }) {
  return (
    <View
      className={`${transparent ? "bg-transparent" : "bg-card"} border-border rounded-2xl border ${className}`}
      style={style}
      {...props}
    />
  );
}

export function PostalPaperBackground({
  children,
  className = "",
  style,
  ...props
}: ComponentProps<typeof View>) {
  return (
    <View
      className={`bg-background flex-1 ${className}`}
      style={[{ flex: 1, minHeight: 0 }, style]}
      {...props}
    >
      {children}
    </View>
  );
}

export function PostalWell({
  className = "",
  ...props
}: ComponentProps<typeof View>) {
  return (
    <View
      className={`bg-muted border-border rounded-2xl border ${className}`}
      {...props}
    />
  );
}
