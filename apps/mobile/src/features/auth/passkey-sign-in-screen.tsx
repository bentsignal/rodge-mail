import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { PostalSurface } from "~/features/theme/postal-surface";
import roundedIcon from "../../../assets/rounded-icon.png";
import {
  RecoveryEmailForm,
  RegistrationDetailsForm,
  VerificationCodeForm,
} from "./account-registration-form";
import { NativeAuthButton } from "./native-auth-button";
import { usePasskeyAuth } from "./use-passkey-auth";

export function PasskeySignInScreen() {
  const auth = usePasskeyAuth();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="bg-background flex-1"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-auto w-full max-w-sm gap-8">
          <BrandHeader />
          <AuthPanel auth={auth} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BrandHeader() {
  return (
    <View className="items-center gap-3">
      <Image
        accessibilityLabel="Rodge Mail"
        className="border-brass/60 size-20 rounded-[22px] border"
        source={roundedIcon}
      />
      <Text className="text-foreground text-[28px] font-bold tracking-tight">
        Rodge Mail
      </Text>
    </View>
  );
}

function AuthPanel({ auth }: { auth: ReturnType<typeof usePasskeyAuth> }) {
  if (auth.view === "sign-in") {
    return <SignInActions auth={auth} />;
  }

  return (
    <PostalSurface className="gap-5 px-5 py-5">
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
  if (auth.view === "recover") {
    return (
      <>
        <AuthTitle>Sign in with email</AuthTitle>
        <RecoveryEmailForm
          email={auth.email}
          isLoading={auth.operation === "request-code"}
          onEmailChange={auth.setEmail}
          onSubmit={() => void auth.requestRecoveryCode()}
        />
      </>
    );
  }
  if (auth.view === "recover-code") {
    return (
      <>
        <AuthTitle>Check your email</AuthTitle>
        <VerificationCodeForm
          code={auth.code}
          email={auth.email}
          isLoading={auth.operation === "verify"}
          onCodeChange={auth.setCode}
          onSubmit={() => void auth.signInWithRecoveryCode()}
        />
      </>
    );
  }
  return null;
}

function AuthTitle({ children }: { children: string }) {
  return <Text className="text-foreground text-xl font-bold">{children}</Text>;
}

function AuthNavigation({ auth }: { auth: ReturnType<typeof usePasskeyAuth> }) {
  if (auth.view === "verify" || auth.view === "recover-code") {
    return (
      <NavigationButton
        label="Change email"
        onPress={() =>
          auth.show(auth.view === "verify" ? "details" : "recover")
        }
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
  if (auth.view === "recover") {
    return (
      <NavigationButton
        label="Back to sign in"
        onPress={() => auth.show("sign-in")}
      />
    );
  }
  return null;
}

function SignInActions({ auth }: { auth: ReturnType<typeof usePasskeyAuth> }) {
  const isLoading = auth.operation === "sign-in";

  return (
    <View className="gap-3">
      <NativeAuthButton
        disabled={isLoading}
        label="Sign in"
        onPress={() => void auth.signIn()}
        variant="filled"
      />
      <NativeAuthButton
        disabled={isLoading}
        label="Create account"
        onPress={() => auth.show("details")}
        variant="outlined"
      />
      <NativeAuthButton
        disabled={isLoading}
        label="Sign in with email"
        onPress={() => auth.show("recover")}
        variant="text"
      />
      <AuthMessage message={auth.message} />
    </View>
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

function AuthMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <Text className="text-muted-foreground text-center text-sm">{message}</Text>
  );
}
