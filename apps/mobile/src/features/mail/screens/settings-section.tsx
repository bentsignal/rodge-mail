import { Text, View } from "react-native";

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
      <View className="bg-muted/60 border-border overflow-hidden rounded-2xl border">
        {children}
      </View>
    </View>
  );
}
