import { Pressable } from "react-native";
import { Stack } from "expo-router";
import { Keyboard, Send } from "lucide-react-native";

import { useColor } from "~/hooks/use-color";

export function ComposerTabHeader({
  canSend,
  onDismissKeyboard,
  onSend,
}: {
  canSend: boolean;
  onDismissKeyboard: () => void;
  onSend: () => void;
}) {
  const foreground = useColor("foreground");
  const primary = useColor("primary");
  const primaryForeground = useColor("primary-foreground");

  return (
    <Stack.Screen
      options={{
        headerLeft: () => (
          <Pressable
            accessibilityLabel="Dismiss keyboard"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onDismissKeyboard}
          >
            <Keyboard color={foreground} size={21} />
          </Pressable>
        ),
        headerRight: () => (
          <Pressable
            accessibilityLabel="Send email"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            className="size-10 items-center justify-center rounded-full"
            disabled={!canSend}
            hitSlop={10}
            onPress={onSend}
            style={{ backgroundColor: primary }}
          >
            <Send
              color={primaryForeground}
              opacity={canSend ? 1 : 0.3}
              size={18}
            />
          </Pressable>
        ),
        title: "New message",
      }}
    />
  );
}
