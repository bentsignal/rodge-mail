import { Platform } from "react-native";
import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerTransparent: Platform.OS === "ios",
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerLargeTitle: true, title: "Settings" }}
      />
      <Stack.Screen name="account/[id]" options={{ title: "" }} />
      <Stack.Screen name="add-account" options={{ title: "Add Account" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
    </Stack>
  );
}
