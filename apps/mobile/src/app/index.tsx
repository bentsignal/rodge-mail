import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";

import { PasskeySignInScreen } from "~/features/auth/passkey-sign-in-screen";
import { useColor } from "~/hooks/use-color";

export default function Index() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const primary = useColor("primary");

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator color={primary} size="large" />
      </View>
    );
  }
  if (!isAuthenticated) return <PasskeySignInScreen />;
  return <Redirect href="/(tabs)/(inbox)" />;
}
