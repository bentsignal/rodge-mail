import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyRound } from "lucide-react-native";

export function PasskeyRegistrationForm({
  email,
  isLoading,
  name,
  onEmailChange,
  onNameChange,
  onPasskeyLabelChange,
  onSubmit,
  passkeyLabel,
}: {
  email: string;
  isLoading: boolean;
  name: string;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPasskeyLabelChange: (value: string) => void;
  onSubmit: () => void;
  passkeyLabel: string;
}) {
  const isDisabled =
    isLoading || !name.trim() || !email.trim() || !passkeyLabel.trim();

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
      <TextInput
        accessibilityLabel="Passkey label"
        className="bg-background border-border text-foreground h-12 rounded-xl border px-4"
        defaultValue={passkeyLabel}
        editable={!isLoading}
        onChangeText={onPasskeyLabelChange}
        placeholder="Passkey label"
        placeholderTextColor="#8f897f"
      />
      <Pressable
        accessibilityRole="button"
        className="border-border h-12 flex-row items-center justify-center gap-2 rounded-xl border disabled:opacity-50"
        disabled={isDisabled}
        onPress={onSubmit}
      >
        <RegistrationIcon isLoading={isLoading} />
        <Text className="text-foreground font-semibold">
          Create account and passkey
        </Text>
      </Pressable>
    </View>
  );
}

function RegistrationIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <ActivityIndicator color="#d77a55" />;
  return <KeyRound color="#d77a55" size={18} />;
}
