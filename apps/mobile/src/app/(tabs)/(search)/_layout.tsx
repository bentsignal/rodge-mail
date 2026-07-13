import { Stack } from "expo-router";

import { useColor } from "~/hooks/use-color";

export default function SearchLayout() {
  const backgroundColor = useColor("background");
  const foreground = useColor("foreground");
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor },
        headerShadowVisible: false,
        headerStyle: { backgroundColor },
        headerTintColor: foreground,
        headerTitle: "",
        headerTitleStyle: { color: foreground },
      }}
    />
  );
}
