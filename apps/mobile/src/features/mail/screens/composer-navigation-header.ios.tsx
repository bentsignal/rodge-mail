import { Stack } from "expo-router";

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
      <ModalCloseToolbar
        color={foreground}
        onCancel={onCancel}
        variant={variant}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityHint="Queues this message to be sent"
          accessibilityLabel="Send email"
          disabled={!canSend}
          tintColor={primary}
          variant="done"
          onPress={onSend}
        >
          Send
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}

function ModalCloseToolbar({
  color,
  onCancel,
  variant,
}: {
  color: string;
  onCancel: () => void;
  variant: "modal" | "tab";
}) {
  if (variant === "tab") return null;

  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        accessibilityLabel="Close new message"
        icon="xmark"
        tintColor={color}
        onPress={onCancel}
      />
    </Stack.Toolbar>
  );
}
