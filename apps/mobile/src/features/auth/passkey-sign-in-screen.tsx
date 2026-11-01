import { Image, Text, View } from "react-native";

import roundedIcon from "../../../assets/icon.png";
import { NativeAuthButton } from "./native-auth-button";
import { usePasskeyAuth } from "./use-passkey-auth";

export function PasskeySignInScreen() {
  const auth = usePasskeyAuth();

  return (
    <View className="bg-background flex-1 justify-center px-6 py-10">
      <View className="mx-auto w-full max-w-sm gap-8">
        <BrandHeader />
        <View className="gap-3">
          <NativeAuthButton
            disabled={auth.isSigningIn}
            label="Sign in with passkey"
            onPress={() => void auth.signIn()}
            variant="filled"
          />
          <AuthMessage message={auth.message} />
        </View>
      </View>
    </View>
  );
}

function BrandHeader() {
  return (
    <View className="items-center gap-3">
      <Image
        accessibilityLabel="Rodge Mail"
        className="size-20 rounded-[22px]"
        source={roundedIcon}
      />
      <Text className="text-foreground text-[28px] font-bold tracking-tight">
        Rodge Mail
      </Text>
    </View>
  );
}

function AuthMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <Text className="text-muted-foreground text-center text-sm">{message}</Text>
  );
}
