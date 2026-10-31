import { StyleSheet, Text, TextInput, View } from "react-native";

import { useColor } from "~/hooks/use-color";

/** One line of the composer's header, like Mail's: a label and a hairline. */
export function ComposerRow({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label?: string;
}) {
  const border = useColor("border");
  return (
    <View
      className="ml-4 pr-4"
      style={{ borderBottomColor: border, borderBottomWidth: StyleSheet.hairlineWidth }}
    >
      <View className="min-h-11 flex-row flex-wrap items-center gap-x-1.5 gap-y-1 py-1.5">
        {label ? (
          <Text className="text-muted-foreground text-base">{label}</Text>
        ) : null}
        {children}
      </View>
      {error ? (
        <Text className="text-destructive -mt-0.5 pb-1.5 text-xs">{error}</Text>
      ) : null}
    </View>
  );
}

export function ComposerTextField({
  label,
  style,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");
  return (
    <ComposerRow label={`${label}:`}>
      <TextInput
        accessibilityLabel={label}
        className="text-foreground min-h-8 min-w-0 flex-1 text-base"
        placeholderTextColor={mutedForeground}
        selectionColor={primary}
        style={[{ color: foreground, paddingVertical: 4 }, style]}
        {...props}
      />
    </ComposerRow>
  );
}
