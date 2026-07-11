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

import { PostalSurface } from "~/features/theme/postal-surface";
import { useColor } from "~/hooks/use-color";
import roundedIcon from "../../../assets/rounded-icon.png";
import {
  RegistrationDetailsForm,
  VerificationCodeForm,
} from "./account-registration-form";
import { authClient } from "./client";

type AuthOperation = "request-code" | "sign-in" | "verify";
type AuthView = "details" | "sign-in" | "verify";

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
        <View className="mx-auto w-full max-w-md gap-7">
          <BrandHeader />
          <AuthPanel auth={auth} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function usePasskeyAuth() {
  const [view, setView] = useState<AuthView>("sign-in");
  const [operation, setOperation] = useState<AuthOperation>();
  const [message, setMessage] = useState<string>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

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
      finishWithError(error);
    }
  }

  async function requestCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim() || !normalizedEmail) return;
    setEmail(normalizedEmail);
    setOperation("request-code");
    setMessage(undefined);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      });
      setOperation(undefined);
      if (result.error) {
        setMessage(
          result.error.message ?? "Could not send a verification code",
        );
        return;
      }
      setView("verify");
    } catch (error) {
      finishWithError(error);
    }
  }

  async function verifyAndCreatePasskey() {
    const otp = code.trim();
    if (otp.length !== 6) return;
    let didVerify = false;
    setOperation("verify");
    setMessage(undefined);
    try {
      const verification = await authClient.signIn.emailOtp({
        email,
        name: name.trim(),
        otp,
      });
      if (verification.error) {
        setOperation(undefined);
        setMessage(verification.error.message ?? "Verification failed");
        return;
      }
      didVerify = true;
      const passkey = await authClient.passkey.addPasskey({
        authenticatorAttachment: "platform",
      });
      setOperation(undefined);
      if (passkey.error) {
        await signOutAfterFailedPasskey();
        setMessage(passkey.error.message ?? "Could not create a passkey");
      }
    } catch (error) {
      if (didVerify) await signOutAfterFailedPasskey();
      finishWithError(error);
    }
  }

  function finishWithError(error: unknown) {
    setOperation(undefined);
    setMessage(getErrorMessage(error));
  }

  function show(nextView: AuthView) {
    setView(nextView);
    setMessage(undefined);
  }

  return {
    code,
    email,
    message,
    name,
    operation,
    requestCode,
    setCode,
    setEmail,
    setName,
    show,
    signIn,
    verifyAndCreatePasskey,
    view,
  };
}

async function signOutAfterFailedPasskey() {
  try {
    await authClient.signOut();
  } catch {
    return;
  }
}

function BrandHeader() {
  return (
    <View className="items-center gap-3">
      <Image
        accessibilityLabel="Rodge Mail"
        className="border-brass/60 size-24 rounded-[26px] border"
        source={roundedIcon}
      />
      <View className="items-center gap-1">
        <Text className="text-foreground text-3xl font-bold tracking-tight">
          Rodge Mail
        </Text>
        <Text className="text-muted-foreground text-sm">
          Your mail, gathered in one place.
        </Text>
      </View>
    </View>
  );
}

function AuthPanel({ auth }: { auth: ReturnType<typeof usePasskeyAuth> }) {
  return (
    <PostalSurface className="gap-5 px-5 py-6">
      <View className="bg-brass-soft/55 mx-auto h-1 w-16 rounded-full" />
      <AuthContent auth={auth} />
      <AuthNavigation auth={auth} />
      <AuthMessage message={auth.message} />
    </PostalSurface>
  );
}

function AuthContent({ auth }: { auth: ReturnType<typeof usePasskeyAuth> }) {
  if (auth.view === "details") {
    return (
      <>
        <AuthTitle>Create account</AuthTitle>
        <RegistrationDetailsForm
          email={auth.email}
          isLoading={auth.operation === "request-code"}
          name={auth.name}
          onEmailChange={auth.setEmail}
          onNameChange={auth.setName}
          onSubmit={() => void auth.requestCode()}
        />
      </>
    );
  }
  if (auth.view === "verify") {
    return (
      <>
        <AuthTitle>Verify your email</AuthTitle>
        <VerificationCodeForm
          code={auth.code}
          email={auth.email}
          isLoading={auth.operation === "verify"}
          onCodeChange={auth.setCode}
          onSubmit={() => void auth.verifyAndCreatePasskey()}
        />
      </>
    );
  }
  return (
    <SignInButton
      isLoading={auth.operation === "sign-in"}
      onPress={() => void auth.signIn()}
    />
  );
}

function AuthTitle({ children }: { children: string }) {
  return <Text className="text-foreground text-xl font-bold">{children}</Text>;
}

function AuthNavigation({ auth }: { auth: ReturnType<typeof usePasskeyAuth> }) {
  if (auth.view === "verify") {
    return (
      <NavigationButton
        label="Change email"
        onPress={() => auth.show("details")}
      />
    );
  }
  if (auth.view === "details") {
    return (
      <NavigationButton
        label="Back to sign in"
        onPress={() => auth.show("sign-in")}
      />
    );
  }
  return (
    <NavigationButton
      label="Create an account"
      onPress={() => auth.show("details")}
    />
  );
}

function NavigationButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="items-center rounded-xl py-2"
      onPress={onPress}
    >
      <Text className="text-muted-foreground text-sm font-semibold">
        {label}
      </Text>
    </Pressable>
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
      className="bg-primary border-brass-soft h-14 flex-row items-center justify-center gap-3 rounded-2xl border disabled:opacity-50"
      disabled={isLoading}
      onPress={onPress}
    >
      <SignInIcon isLoading={isLoading} />
      <Text className="text-primary-foreground font-semibold">Sign in</Text>
    </Pressable>
  );
}

function SignInIcon({ isLoading }: { isLoading: boolean }) {
  const primaryForeground = useColor("primary-foreground");
  if (isLoading) return <ActivityIndicator color={primaryForeground} />;
  return null;
}

function AuthMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <Text className="text-muted-foreground text-center text-sm">{message}</Text>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Authentication did not complete.";
}
