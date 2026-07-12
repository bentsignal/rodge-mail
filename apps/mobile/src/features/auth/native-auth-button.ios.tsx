import { useWindowDimensions } from "react-native";
import { Button, Host, Text } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";

interface NativeAuthButtonProps {
  disabled: boolean;
  label: string;
  onPress: () => void;
  variant: "filled" | "outlined" | "text";
}

const BUTTON_STYLES = {
  filled: "borderedProminent",
  outlined: "bordered",
  text: "plain",
} as const;

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
  const labelColor = variant === "filled" ? primaryForeground : primary;

  return (
    <Host
      colorScheme={colorScheme}
      ignoreSafeArea="all"
      seedColor={primary}
      style={{ height, width }}
    >
      <Button
        modifiers={[
          buttonStyle(BUTTON_STYLES[variant]),
          controlSize("large"),
          tint(primary),
          disabledModifier(disabled),
        ]}
        testID={getAuthButtonTestId(label)}
        onPress={onPress}
      >
        <Text
          modifiers={[
            frame({ height: 22, width: width - 40 }),
            font({ size: 16, weight: "semibold" }),
            foregroundStyle(labelColor),
          ]}
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
