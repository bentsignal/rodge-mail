import { Text, View } from "react-native";
import { Host, Switch } from "@expo/ui";

import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import {
  setTemporaryIos27Search,
  useTemporaryIos27Search,
} from "../mobile-search-preference";

export function TemporaryIos27SearchSetting() {
  const colorScheme = useResolvedMobileColorScheme();
  const enabled = useTemporaryIos27Search();
  const primary = useColor("primary");

  return (
    <View className="gap-1 px-4 py-3">
      <Host
        colorScheme={colorScheme}
        matchContents={{ vertical: true }}
        seedColor={primary}
        style={{ width: "100%" }}
      >
        <Switch
          label="Temporary iOS 27 search bar"
          testID="temporary-ios-27-search"
          value={enabled}
          onValueChange={(value) => void setTemporaryIos27Search(value)}
        />
      </Host>
      <Text className="text-muted-foreground text-sm leading-5">
        Removes Search from the tab bar and places a temporary search field
        above the inbox controls. Leave this off on iOS 26.
      </Text>
    </View>
  );
}
