import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Fingerprint, ShieldCheck } from "lucide-react-native";

import { createPasskeyRegistrationContext } from "@rodge-mail/config/auth";

import roundedIcon from "../../../assets/rounded-icon.png";
import { authClient } from "./client";
import { PasskeyRegistrationForm } from "./passkey-registration-form";

type AuthOperation = "register" | "sign-in";

export function PasskeySignInScreen() {
  const auth = usePasskeyAuth();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="bg-background flex-1"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-auto w-full max-w-md gap-6">
          <BrandHeader />
          <AuthCard auth={auth} />
          <SecurityNote />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function usePasskeyAuth() {
  const [operation, setOperation] = useState<AuthOperation>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState<string>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [passkeyLabel, setPasskeyLabel] = useState("My passkey");

  async function signIn() {
    setOperation("sign-in");
    setMessage(undefined);
    try {
      const result = await authClient.signIn.passkey();
      setOperation(undefined);
      if (result.error) {
        setMessage(result.error.message ?? "Passkey sign-in failed");
      }
    } catch (error) {
      setOperation(undefined);
      setMessage(getErrorMessage(error));
    }
  }

  async function register() {
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedLabel = passkeyLabel.trim();
    if (!trimmedName || !normalizedEmail || !trimmedLabel) return;

    setOperation("register");
    setMessage(undefined);
    try {
      const result = await authClient.passkey.addPasskey({
        authenticatorAttachment: "platform",
        context: createPasskeyRegistrationContext({
          email: normalizedEmail,
          name: trimmedName,
        }),
        name: trimmedLabel,
      });
      setOperation(undefined);
      if (result.error) {
        setMessage(result.error.message ?? "Account creation failed");
        return;
      }
      setIsRegistering(false);
      setMessage("Account created. Sign in with your new passkey to continue.");
    } catch (error) {
      setOperation(undefined);
      setMessage(getErrorMessage(error));
    }
  }

  function toggleRegistration() {
    setIsRegistering((current) => !current);
    setMessage(undefined);
  }

  return {
    email,
    isLoading: operation !== undefined,
    isRegistering,
    message,
    name,
    operation,
    passkeyLabel,
    register,
    setEmail,
    setName,
    setPasskeyLabel,
    signIn,
    toggleRegistration,
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
          Private email. Passkeys only.
        </Text>
      </View>
    </View>
  );
}

function AuthCard({ auth }: { auth: ReturnType<typeof usePasskeyAuth> }) {
  return (
    <View className="bg-muted/55 border-border gap-4 rounded-3xl border p-5">
      <AuthCardHeader isRegistering={auth.isRegistering} />
      <AuthForm auth={auth} />
      <Pressable
        accessibilityRole="button"
        className="items-center py-1 disabled:opacity-50"
        disabled={auth.isLoading}
        onPress={auth.toggleRegistration}
      >
        <Text className="text-muted-foreground text-sm font-semibold">
          {getAuthToggleLabel(auth.isRegistering)}
        </Text>
      </Pressable>
      <AuthMessage message={auth.message} />
    </View>
  );
}

function AuthCardHeader({ isRegistering }: { isRegistering: boolean }) {
  if (isRegistering) {
    return (
      <View className="gap-1">
        <Text className="text-foreground text-lg font-semibold">
          Create your account
        </Text>
        <Text className="text-muted-foreground text-sm leading-5">
          Enter your details and create a passkey for Rodge Mail.
        </Text>
      </View>
    );
  }
  return (
    <View className="gap-1">
      <Text className="text-foreground text-lg font-semibold">
        Welcome back
      </Text>
      <Text className="text-muted-foreground text-sm leading-5">
        Use a passkey saved to this device or available through your password
        manager.
      </Text>
    </View>
  );
}

function AuthForm({ auth }: { auth: ReturnType<typeof usePasskeyAuth> }) {
  if (auth.isRegistering) {
    return (
      <PasskeyRegistrationForm
        email={auth.email}
        isLoading={auth.operation === "register"}
        name={auth.name}
        onEmailChange={auth.setEmail}
        onNameChange={auth.setName}
        onPasskeyLabelChange={auth.setPasskeyLabel}
        onSubmit={() => void auth.register()}
        passkeyLabel={auth.passkeyLabel}
      />
    );
  }
  return (
    <SignInButton
      isLoading={auth.operation === "sign-in"}
      onPress={() => void auth.signIn()}
    />
  );
}

function SignInButton({
  isLoading,
  onPress,
}: {
  isLoading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="h-13 flex-row items-center justify-center gap-3 rounded-xl bg-[#20251f] disabled:opacity-50"
      disabled={isLoading}
      onPress={onPress}
    >
      <SignInIcon isLoading={isLoading} />
      <Text className="font-semibold text-[#f7f1e6]">
        Sign in with a passkey
      </Text>
    </Pressable>
  );
}

function SignInIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <ActivityIndicator color="#f7f1e6" />;
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
        Passkeys require biometric or device-PIN verification. Add another
        passkey from Settings after signing in.
      </Text>
    </View>
  );
}

function getAuthToggleLabel(isRegistering: boolean) {
  if (isRegistering) return "Back to sign in";
  return "Create an account";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Passkey authentication did not complete.";
}
