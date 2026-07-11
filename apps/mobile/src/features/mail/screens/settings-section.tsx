import { Text, View } from "react-native";

import { PostalSurface } from "~/features/theme/postal-surface";

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-muted-foreground px-2 text-xs font-semibold tracking-wider uppercase">
        {title}
      </Text>
      <PostalSurface className="overflow-hidden rounded-2xl">
        {children}
      </PostalSurface>
    </View>
  );
}
