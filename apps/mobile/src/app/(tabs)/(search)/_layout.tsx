import { Stack } from "expo-router";

import { useColor } from "~/hooks/use-color";

export default function SearchLayout() {
  const backgroundColor = useColor("background");
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "transparent" },
        headerTitle: "",
        headerTransparent: true,
      }}
    />
  );
}
