import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";

import { OwnerSignInScreen } from "~/features/auth/owner-sign-in-screen";

export default function Index() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator color="#d77a55" size="large" />
      </View>
    );
  }
  if (!isAuthenticated) return <OwnerSignInScreen />;
  return <Redirect href="/(tabs)/(inbox)" />;
}
