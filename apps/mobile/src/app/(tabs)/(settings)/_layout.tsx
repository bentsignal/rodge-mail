import { Stack } from "expo-router";

import { useColor } from "~/hooks/use-color";

export default function SettingsLayout() {
  const backgroundColor = useColor("background");
  const foreground = useColor("foreground");

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor },
        headerLargeStyle: { backgroundColor },
        headerLargeTitleStyle: { color: foreground },
        headerStyle: { backgroundColor },
        headerShadowVisible: false,
        headerTintColor: foreground,
        headerTitleStyle: { color: foreground },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerLargeTitle: true, title: "Settings" }}
      />
      <Stack.Screen
        name="archive"
        options={{ headerLargeTitle: false, title: "Archive" }}
      />
    </Stack>
  );
}
