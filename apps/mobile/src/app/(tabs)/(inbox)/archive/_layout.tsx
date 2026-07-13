import { Stack } from "expo-router";

import { useColor } from "~/hooks/use-color";

export default function ArchiveLayout() {
  const backgroundColor = useColor("background");
  const foreground = useColor("foreground");

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor },
        headerBackButtonDisplayMode: "minimal",
        headerStyle: { backgroundColor },
        headerShadowVisible: false,
        headerTintColor: foreground,
        headerTitleStyle: { color: foreground },
      }}
    >
      <Stack.Screen name="index" options={{ headerTitle: "" }} />
      <Stack.Screen name="thread/[id]" options={{ title: "Message" }} />
    </Stack>
  );
}
