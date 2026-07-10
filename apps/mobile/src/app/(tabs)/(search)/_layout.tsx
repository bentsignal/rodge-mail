import { Stack } from "expo-router";

import { useColor } from "~/hooks/use-color";

export default function SearchLayout() {
  const backgroundColor = useColor("background");

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Search" }} />
      <Stack.Screen name="thread/[id]" options={{ title: "Message" }} />
    </Stack>
  );
}
