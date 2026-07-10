import { Button, Host } from "@expo/ui";

export function NativeMailButton({
  label,
  onPress,
  seedColor,
}: {
  label: string;
  onPress: () => void;
  seedColor: string;
}) {
  return (
    <Host matchContents seedColor={seedColor}>
      <Button
        label={label}
        onPress={onPress}
        style={{
          borderRadius: 24,
          height: 48,
          paddingHorizontal: 18,
        }}
      />
    </Host>
  );
}
