import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

export function RegistrationDetailsForm({
  email,
  isLoading,
  name,
  onEmailChange,
  onNameChange,
  onSubmit,
}: {
  email: string;
  isLoading: boolean;
  name: string;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View className="gap-3">
      <TextInput
        accessibilityLabel="Full name"
        autoCapitalize="words"
        className="bg-background border-border text-foreground h-12 rounded-xl border px-4"
        defaultValue={name}
        editable={!isLoading}
        onChangeText={onNameChange}
        placeholder="Full name"
        placeholderTextColor="#8f897f"
      />
      <TextInput
        accessibilityLabel="Email address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        className="bg-background border-border text-foreground h-12 rounded-xl border px-4"
        defaultValue={email}
        editable={!isLoading}
        inputMode="email"
        onChangeText={onEmailChange}
        placeholder="Email address"
        placeholderTextColor="#8f897f"
      />
      <ActionButton
        disabled={isLoading || !name.trim() || !email.trim()}
        isLoading={isLoading}
        label="Continue"
        onPress={onSubmit}
      />
    </View>
  );
}

export function VerificationCodeForm({
  code,
  email,
  isLoading,
  onCodeChange,
  onSubmit,
}: {
  code: string;
  email: string;
  isLoading: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View className="gap-3">
      <Text className="text-muted-foreground text-sm leading-5">
        Enter the six-digit code sent to {email}.
      </Text>
      <TextInput
        accessibilityLabel="Verification code"
        autoComplete="one-time-code"
        className="bg-background border-border text-foreground h-12 rounded-xl border px-4 font-mono tracking-[0.3em]"
        defaultValue={code}
        editable={!isLoading}
        inputMode="numeric"
        maxLength={6}
        onChangeText={onCodeChange}
        placeholder="000000"
        placeholderTextColor="#8f897f"
      />
      <ActionButton
        disabled={isLoading || code.trim().length !== 6}
        isLoading={isLoading}
        label="Verify and continue"
        onPress={onSubmit}
      />
    </View>
  );
}

function ActionButton({
  disabled,
  isLoading,
  label,
  onPress,
}: {
  disabled: boolean;
  isLoading: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="border-border h-12 flex-row items-center justify-center gap-2 rounded-xl border disabled:opacity-50"
      disabled={disabled}
      onPress={onPress}
    >
      <ActionIcon isLoading={isLoading} />
      <Text className="text-foreground font-semibold">{label}</Text>
    </Pressable>
  );
}

function ActionIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <ActivityIndicator color="#d77a55" />;
  return null;
}
