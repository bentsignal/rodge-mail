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
        headerTintColor: foreground,
        headerTitleStyle: { color: foreground },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerLargeTitle: true, headerTitle: "Inbox" }}
      />
      <Stack.Screen name="thread/[id]" options={{ title: "Message" }} />
    </Stack>
  );
}
