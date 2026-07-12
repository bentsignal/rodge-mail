import { useWindowDimensions } from "react-native";
import { Button, Host, Text } from "@expo/ui";

import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";

export interface NativeAuthButtonProps {
  disabled: boolean;
  label: string;
  onPress: () => void;
  variant: "filled" | "outlined" | "text";
}

export function NativeAuthButton({
  disabled,
  label,
  onPress,
  variant,
}: NativeAuthButtonProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const colorScheme = useResolvedMobileColorScheme();
  const primary = useColor("primary");
  const primaryForeground = useColor("primary-foreground");
  const width = Math.min(viewportWidth - 48, 384);
  const height = variant === "text" ? 40 : 50;

  return (
    <Host
      colorScheme={colorScheme}
      ignoreSafeArea="all"
      seedColor={primary}
      style={{ height, width }}
    >
      <Button
        disabled={disabled}
        style={{ height, width }}
        testID={getAuthButtonTestId(label)}
        variant={variant}
        onPress={onPress}
      >
        <Text
          style={{ width: width - 40 }}
          textStyle={{
            color: variant === "filled" ? primaryForeground : primary,
            fontSize: 16,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          {label}
        </Text>
      </Button>
    </Host>
  );
}

function getAuthButtonTestId(label: string) {
  return `auth-${label
    .toLowerCase()
    .replaceAll(/[^a-z]+/g, "-")
    .replace(/-$/, "")}`;
}
