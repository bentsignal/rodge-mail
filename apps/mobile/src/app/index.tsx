import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";

import { PasskeySignInScreen } from "~/features/auth/passkey-sign-in-screen";

export default function Index() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator color="#d77a55" size="large" />
      </View>
    );
  }
  if (!isAuthenticated) return <PasskeySignInScreen />;
  return <Redirect href="/(tabs)/(inbox)" />;
}
