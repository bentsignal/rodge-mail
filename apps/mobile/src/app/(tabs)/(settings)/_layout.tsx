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
        headerTintColor: foreground,
        headerTitleStyle: { color: foreground },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerLargeTitle: true, title: "Settings" }}
      />
    </Stack>
  );
}
