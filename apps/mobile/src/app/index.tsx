import { View } from "react-native";
import { Redirect } from "expo-router";

import { PasskeySignInScreen } from "~/features/auth/passkey-sign-in-screen";
import { useStableAuthState } from "~/features/auth/use-stable-auth-state";

export default function Index() {
  const { isAuthenticated, isInitialLoading } = useStableAuthState();

  if (isInitialLoading) return <View className="bg-background flex-1" />;
  if (!isAuthenticated) return <PasskeySignInScreen />;
  return <Redirect href="/(tabs)/(inbox)" />;
}
