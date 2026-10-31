import { Stack } from "expo-router";

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
  const foreground = useColor("foreground");
  const primary = useColor("primary");

  return (
    <>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerShadowVisible: false,
          headerShown: true,
          headerTintColor: foreground,
          headerTransparent: true,
          title,
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel="Cancel"
          hidden={variant === "tab"}
          icon="xmark"
          onPress={onCancel}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          accessibilityLabel="Add attachment"
          icon="paperclip"
        >
          <Stack.Toolbar.MenuAction
            icon="photo.on.rectangle"
            onPress={onAttachPhotos}
          >
            Photo Library
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="folder" onPress={onAttachFiles}>
            Choose File
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          accessibilityLabel="Send"
          disabled={!canSend}
          icon="arrow.up"
          tintColor={primary}
          variant="prominent"
          onPress={onSend}
        />
      </Stack.Toolbar>
    </>
  );
}
