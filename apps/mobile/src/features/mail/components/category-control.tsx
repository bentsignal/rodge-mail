import { Pressable, Text, View } from "react-native";

import type { CategoryControlProps } from "./category-control-types";

export function CategoryControl({ value, onChange }: CategoryControlProps) {
  return (
    <View className="bg-muted flex-row rounded-xl p-1">
      <CategoryButton
        label="Focused"
        selected={value === "focused"}
        onPress={() => onChange("focused")}
      />
      <CategoryButton
        label="Other"
        selected={value === "other"}
        onPress={() => onChange("other")}
      />
    </View>
  );
}

function CategoryButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={selected ? "bg-background flex-1 rounded-lg" : "flex-1"}
      onPress={onPress}
    >
      <Text className="text-foreground py-2 text-center text-sm font-semibold">
        {label}
      </Text>
    </Pressable>
  );
}
