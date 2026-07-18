import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";

import { PasskeySignInScreen } from "~/features/auth/passkey-sign-in-screen";
import { useStableAuthState } from "~/features/auth/use-stable-auth-state";
import { useColor } from "~/hooks/use-color";

export default function Index() {
  const { isAuthenticated, isInitialLoading } = useStableAuthState();
  const primary = useColor("primary");

  if (isInitialLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator color={primary} size="large" />
      </View>
    );
  }
  if (!isAuthenticated) return <PasskeySignInScreen />;
  return <Redirect href="/(tabs)/(inbox)" />;
}
