import { Stack } from "expo-router";

import { useColor } from "~/hooks/use-color";

export default function SettingsLayout() {
  const backgroundColor = useColor("background");

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor } }}>
      <Stack.Screen
        name="index"
        options={{ headerLargeTitle: true, title: "Settings" }}
      />
    </Stack>
  );
}
