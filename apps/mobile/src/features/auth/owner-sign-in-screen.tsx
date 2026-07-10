import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react-native";

import roundedIcon from "../../../assets/rounded-icon.png";
import { authClient } from "./client";

type AuthOperation = "setup" | "sign-in";

export function OwnerSignInScreen() {
  const auth = useOwnerAuthActions();

  return (
    <KeyboardAvoidingView
      behavior={getKeyboardAvoidingBehavior()}
      className="bg-background flex-1"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-auto w-full max-w-md gap-6">
          <BrandHeader />
          <SignInCard auth={auth} />
          <SecurityNote />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function useOwnerAuthActions() {
  const [operation, setOperation] = useState<AuthOperation>();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [message, setMessage] = useState<string>();
  const [passkeyName, setPasskeyName] = useState("Mobile passkey");
  const [token, setToken] = useState("");
  const [tokenInputKey, setTokenInputKey] = useState(0);

  async function signIn() {
    await runAuthAction("sign-in", async () => {
      const result = await authClient.signIn.passkey();
      if (result.error) {
        throw new Error(result.error.message ?? "Passkey sign-in failed");
      }
    });
  }

  async function createOwnerPasskey() {
    if (!passkeyName.trim() || !token) return;
    await runAuthAction("setup", async () => {
      const result = await authClient.passkey.addPasskey({
        authenticatorAttachment: "platform",
        context: token,
        name: passkeyName.trim(),
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Passkey setup failed");
      }
      setToken("");
      setTokenInputKey((current) => current + 1);
      setMessage("Passkey created. Sign in to open Rodge Mail.");
      setIsSettingUp(false);
    });
  }

  async function runAuthAction(
    nextOperation: AuthOperation,
    action: () => Promise<void>,
  ) {
    setOperation(nextOperation);
    setMessage(undefined);
    try {
      await action();
    } catch (error) {
      setMessage(getErrorMessage(error));
      setOperation(undefined);
      return;
    }
    setOperation(undefined);
  }

  function toggleSetup() {
    setIsSettingUp((current) => !current);
    setMessage(undefined);
  }

  return {
    createOwnerPasskey,
    isLoading: operation !== undefined,
    isSettingUp,
    message,
    operation,
    passkeyName,
    setPasskeyName,
    setToken,
    signIn,
    token,
    tokenInputKey,
    toggleSetup,
  };
}

function BrandHeader() {
  return (
    <View className="items-center gap-3">
      <Image
        accessibilityLabel="Rodge Mail"
        className="size-24 rounded-[26px]"
        source={roundedIcon}
      />
      <View className="items-center gap-1">
        <Text className="text-foreground text-3xl font-bold">Rodge Mail</Text>
        <Text className="text-muted-foreground text-center text-sm leading-5">
          One private inbox. Passkeys only.
        </Text>
      </View>
    </View>
  );
}

function SignInCard({
  auth,
}: {
  auth: ReturnType<typeof useOwnerAuthActions>;
}) {
  return (
    <View className="bg-muted/55 border-border gap-4 rounded-3xl border p-5">
      <View className="gap-1">
        <Text className="text-foreground text-lg font-semibold">
          Welcome back, Shawn
        </Text>
        <Text className="text-muted-foreground text-sm leading-5">
          Use a passkey saved to this device or available through your password
          manager.
        </Text>
      </View>
      <AuthButton
        disabled={auth.isLoading}
        loading={auth.operation === "sign-in"}
        onPress={() => void auth.signIn()}
      />
      <SetupToggle
        disabled={auth.isLoading}
        isSettingUp={auth.isSettingUp}
        onPress={auth.toggleSetup}
      />
      <OwnerSetupFields auth={auth} />
      <AuthMessage message={auth.message} />
    </View>
  );
}

function SetupToggle({
  disabled,
  isSettingUp,
  onPress,
}: {
  disabled: boolean;
  isSettingUp: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="items-center py-1"
      disabled={disabled}
      onPress={onPress}
    >
      <Text className="text-muted-foreground text-sm font-semibold">
        {getSetupToggleLabel(isSettingUp)}
      </Text>
    </Pressable>
  );
}

function OwnerSetupFields({
  auth,
}: {
  auth: ReturnType<typeof useOwnerAuthActions>;
}) {
  if (!auth.isSettingUp) return null;
  return (
    <View className="border-border gap-3 border-t pt-4">
      <TextInput
        accessibilityLabel="Passkey name"
        className="bg-background border-border text-foreground h-12 rounded-xl border px-4"
        defaultValue={auth.passkeyName}
        editable={!auth.isLoading}
        onChangeText={auth.setPasskeyName}
        placeholder="Passkey name"
        placeholderTextColor="#8f897f"
      />
      <TextInput
        key={auth.tokenInputKey}
        accessibilityLabel="One-time owner setup token"
        autoCapitalize="none"
        autoCorrect={false}
        className="bg-background border-border text-foreground h-12 rounded-xl border px-4"
        editable={!auth.isLoading}
        onChangeText={auth.setToken}
        placeholder="One-time setup token"
        placeholderTextColor="#8f897f"
        secureTextEntry
      />
      <SetupButton auth={auth} />
    </View>
  );
}

function SetupButton({
  auth,
}: {
  auth: ReturnType<typeof useOwnerAuthActions>;
}) {
  const disabled = auth.isLoading || !auth.passkeyName.trim() || !auth.token;
  return (
    <Pressable
      accessibilityRole="button"
      className="border-border h-12 flex-row items-center justify-center gap-2 rounded-xl border disabled:opacity-50"
      disabled={disabled}
      onPress={() => void auth.createOwnerPasskey()}
    >
      <SetupButtonIcon loading={auth.operation === "setup"} />
      <Text className="text-foreground font-semibold">
        Create owner passkey
      </Text>
    </Pressable>
  );
}

function SetupButtonIcon({ loading }: { loading: boolean }) {
  if (loading) return <ActivityIndicator color="#d77a55" />;
  return <KeyRound color="#d77a55" size={18} />;
}

function AuthButton({
  disabled,
  loading,
  onPress,
}: {
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="h-13 flex-row items-center justify-center gap-3 rounded-xl bg-[#20251f] disabled:opacity-50"
      disabled={disabled}
      onPress={onPress}
    >
      <AuthButtonIcon loading={loading} />
      <Text className="font-semibold text-[#f7f1e6]">
        Sign in with a passkey
      </Text>
    </Pressable>
  );
}

function AuthButtonIcon({ loading }: { loading: boolean }) {
  if (loading) return <ActivityIndicator color="#f7f1e6" />;
  return <Fingerprint color="#f7f1e6" size={20} />;
}

function AuthMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <Text className="text-muted-foreground text-center text-sm leading-5">
      {message}
    </Text>
  );
}

function SecurityNote() {
  return (
    <View className="flex-row items-start gap-3 px-2">
      <ShieldCheck color="#397367" size={18} />
      <Text className="text-muted-foreground flex-1 text-xs leading-5">
        Biometric or device-PIN verification is required. The one-time setup
        token is cleared after every successful registration.
      </Text>
    </View>
  );
}

function getKeyboardAvoidingBehavior() {
  if (Platform.OS === "ios") return "padding" as const;
  return undefined;
}

function getSetupToggleLabel(isSettingUp: boolean) {
  if (isSettingUp) return "Cancel initial setup";
  return "Set up this device";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Passkey authentication did not complete.";
}
