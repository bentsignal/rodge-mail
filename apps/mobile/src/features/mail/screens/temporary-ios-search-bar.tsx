import { TextInput, View } from "react-native";
import { Search } from "lucide-react-native";

import { useColor } from "~/hooks/use-color";

export function TemporaryIosSearchBar({
  onChange,
  placeholder = "Search mail",
  value,
}: {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");

  return (
    <View className="bg-paper-deep border-paper-border h-10 flex-row items-center rounded-xl border px-3">
      <Search color={mutedForeground} size={16} />
      <TextInput
        accessibilityLabel="Search mail"
        autoCapitalize="none"
        autoCorrect={false}
        className="text-foreground h-10 min-w-0 flex-1 px-2 text-[16px]"
        clearButtonMode="while-editing"
        inputMode="search"
        placeholder={placeholder}
        placeholderTextColor={mutedForeground}
        returnKeyType="search"
        selectionColor={foreground}
        style={{ letterSpacing: 0 }}
        defaultValue={value}
        onChangeText={onChange}
      />
    </View>
  );
}
