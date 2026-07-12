import { Stack } from "expo-router";

import { useColor } from "~/hooks/use-color";

export default function InboxLayout() {
  const backgroundColor = useColor("background");
  const foreground = useColor("foreground");

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor },
        headerBackButtonDisplayMode: "minimal",
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
        options={{ headerLargeTitle: false, headerTitle: "" }}
      />
      <Stack.Screen name="thread/[id]" options={{ title: "Message" }} />
    </Stack>
  );
}
