import { TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";

import { useColor } from "~/hooks/use-color";

export function TemporaryIosSearchBar({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");

  return (
    <SafeAreaView
      className="bg-paper border-paper-border border-b px-3 pt-1 pb-2"
      edges={["top"]}
    >
      <View className="bg-paper-deep border-paper-border h-11 flex-row items-center rounded-xl border px-3">
        <Search color={mutedForeground} size={17} />
        <TextInput
          accessibilityLabel="Search mail"
          autoCapitalize="none"
          autoCorrect={false}
          className="text-foreground h-11 min-w-0 flex-1 px-2 text-[16px]"
          clearButtonMode="while-editing"
          inputMode="search"
          placeholder="Search mail"
          placeholderTextColor={mutedForeground}
          returnKeyType="search"
          selectionColor={foreground}
          defaultValue={value}
          onChangeText={onChange}
        />
      </View>
    </SafeAreaView>
  );
}
