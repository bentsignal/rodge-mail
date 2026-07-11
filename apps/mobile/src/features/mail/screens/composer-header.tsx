import { Pressable, Text, View } from "react-native";
import { Send, X } from "lucide-react-native";

import { useColor } from "~/hooks/use-color";

export function ComposerHeader({
  canSend,
  onCancel,
  onSend,
}: {
  canSend: boolean;
  onCancel?: () => void;
  onSend: () => void;
}) {
  const foreground = useColor("foreground");

  return (
    <View className="border-border flex-row items-center justify-between border-b px-4 py-3">
      <ComposerCloseButton onCancel={onCancel} />
      <Text className="text-foreground text-lg font-bold">New</Text>
      <Pressable
        accessibilityLabel="Send email"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSend }}
        className="p-2"
        disabled={!canSend}
        hitSlop={10}
        onPress={onSend}
      >
        <Send color={foreground} opacity={canSend ? 1 : 0.3} size={21} />
      </Pressable>
    </View>
  );
}

function ComposerCloseButton({ onCancel }: { onCancel?: () => void }) {
  const foreground = useColor("foreground");

  if (!onCancel) return <View className="h-[38px] w-[38px]" />;
  return (
    <Pressable
      accessibilityLabel="Close new message"
      accessibilityRole="button"
      className="p-2"
      hitSlop={10}
      onPress={onCancel}
    >
      <X color={foreground} size={22} />
    </Pressable>
  );
}
