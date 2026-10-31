import type { ComponentProps } from "react";
import { Host } from "@expo/ui";

import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";

export function NativeHost(props: ComponentProps<typeof Host>) {
  const colorScheme = useResolvedMobileColorScheme();
  const primary = useColor("primary");
  return <Host colorScheme={colorScheme} seedColor={primary} {...props} />;
}
