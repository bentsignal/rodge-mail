import { Text, TextInput, View } from "react-native";

import { useColor } from "~/hooks/use-color";

export function ComposerField({
  error,
  label,
  style,
  ...props
}: {
  error?: string;
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");

  return (
    <View className="border-border min-h-14 flex-row items-center gap-3 border-b py-1">
      <Text className="text-muted-foreground w-14 text-sm font-medium">
        {label}
      </Text>
      <View className="min-w-0 flex-1">
        <TextInput
          accessibilityLabel={label}
          className="text-foreground min-h-12 text-base"
          placeholderTextColor={mutedForeground}
          selectionColor={primary}
          style={[{ color: foreground }, style]}
          {...props}
        />
        <ComposerFieldError error={error} />
      </View>
    </View>
  );
}

export function ComposerSectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-muted-foreground px-1 text-xs font-semibold tracking-[1.4px] uppercase">
      {children}
    </Text>
  );
}

function ComposerFieldError({ error }: { error: string | undefined }) {
  if (!error) return null;
  return <Text className="text-destructive pb-1 text-xs">{error}</Text>;
}
