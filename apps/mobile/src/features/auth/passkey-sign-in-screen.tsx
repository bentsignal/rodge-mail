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
  RecoveryEmailForm,
  RegistrationDetailsForm,
  VerificationCodeForm,
} from "./account-registration-form";
import { usePasskeyAuth } from "./use-passkey-auth";

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
  if (auth.view === "recover") {
    return (
      <>
        <AuthTitle>Restore your sign-in</AuthTitle>
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
          onSubmit={() => void auth.recoverPasskey()}
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
  return (
    <View className="gap-1">
      <NavigationButton
        label="Create an account"
        onPress={() => auth.show("details")}
      />
      <NavigationButton
        label="Can’t use your passkey?"
        onPress={() => auth.show("recover")}
      />
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
