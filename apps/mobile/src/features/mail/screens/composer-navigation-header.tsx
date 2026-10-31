import { Alert } from "react-native";
import { Stack } from "expo-router";
import { Button, Host } from "@expo/ui";

import type { ComposerNavigationHeaderProps } from "./composer-navigation-header.types";
import { useColor } from "~/hooks/use-color";

export function ComposerNavigationHeader({
  canSend,
  onAttachFiles,
  onAttachPhotos,
  onCancel,
  onSend,
  title,
  variant,
}: ComposerNavigationHeaderProps) {
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
          title,
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
        label="Attach"
        placement="right"
        seedColor={primary}
        onPress={() =>
          Alert.alert("Add attachment", undefined, [
            { text: "Photos", onPress: onAttachPhotos },
            { text: "Files", onPress: onAttachFiles },
            { text: "Cancel", style: "cancel" },
          ])
        }
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
