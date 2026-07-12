import { Stack } from "expo-router";
import { Button, Host } from "@expo/ui";

import { useColor } from "~/hooks/use-color";

export function ComposerNavigationHeader({
  canSend,
  onCancel,
  onSend,
  variant,
}: {
  canSend: boolean;
  onCancel: () => void;
  onSend: () => void;
  variant: "modal" | "tab";
}) {
  const backgroundColor = useColor("background");
  const foreground = useColor("foreground");
  const primary = useColor("primary");

  return (
    <>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerShadowVisible: false,
          headerShown: true,
          headerStyle: { backgroundColor },
          headerTintColor: foreground,
          title: "New message",
        }}
      />
      <NativeToolbarButton
        hidden={variant === "tab"}
        label="Close"
        placement="left"
        seedColor={primary}
        onPress={onCancel}
      />
      <NativeToolbarButton
        disabled={!canSend}
        label="Send"
        placement="right"
        seedColor={primary}
        onPress={onSend}
      />
    </>
  );
}

function NativeToolbarButton({
  disabled = false,
  hidden = false,
  label,
  onPress,
  placement,
  seedColor,
}: {
  disabled?: boolean;
  hidden?: boolean;
  label: string;
  onPress: () => void;
  placement: "left" | "right";
  seedColor: string;
}) {
  if (hidden) return null;

  return (
    <Stack.Toolbar placement={placement}>
      <Stack.Toolbar.View>
        <Host matchContents seedColor={seedColor}>
          <Button
            disabled={disabled}
            label={label}
            testID={`composer-${label.toLocaleLowerCase()}-button`}
            variant="text"
            onPress={onPress}
          />
        </Host>
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
