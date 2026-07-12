import { Stack } from "expo-router";

import { useColor } from "~/hooks/use-color";

export default function NewLayout() {
  const backgroundColor = useColor("background");
  const foreground = useColor("foreground");

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor },
        headerBackVisible: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor },
        headerTintColor: foreground,
        headerTitleStyle: { color: foreground },
      }}
    />
  );
}
