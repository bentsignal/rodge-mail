import { Platform } from "react-native";
import { Stack } from "expo-router";

export default function InboxLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerTransparent: Platform.OS === "ios",
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerLargeTitle: true, title: "All Inboxes" }}
      />
      <Stack.Screen name="thread/[id]" options={{ title: "" }} />
    </Stack>
  );
}
