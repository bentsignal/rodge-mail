import { Text, TextInput, View } from "react-native";

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
  return (
    <View className="border-border ml-4 border-b-[0.5px] pr-4">
      <View className="min-h-11 flex-row flex-wrap items-center gap-x-1.5 gap-y-1 py-1.5">
        <RowLabel label={label} />
        {children}
      </View>
      <RowError error={error} />
    </View>
  );
}

function RowLabel({ label }: { label: string | undefined }) {
  if (!label) return null;
  return <Text className="text-muted-foreground text-base">{label}</Text>;
}

function RowError({ error }: { error: string | undefined }) {
  if (!error) return null;
  return (
    <Text className="text-destructive -mt-0.5 pb-1.5 text-xs">{error}</Text>
  );
}

// Font size only: with a line height, iOS draws a single-line TextInput's
// typed text lower than its placeholder and cursor.
export const composerInputTextClassName = "text-foreground text-[16px]";

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
        className={`${composerInputTextClassName} min-h-8 min-w-0 flex-1`}
        placeholderTextColor={mutedForeground}
        selectionColor={primary}
        style={[{ color: foreground, paddingVertical: 0 }, style]}
        {...props}
      />
    </ComposerRow>
  );
}
