import { Pressable, Text, View } from "react-native";
import { Keyboard, Send, X } from "lucide-react-native";

import { postalDisplayFont } from "~/features/theme/postal-typography";
import { useColor } from "~/hooks/use-color";

export function ComposerHeader({
  canSend,
  onCancel,
  onDismissKeyboard,
  onSend,
}: {
  canSend: boolean;
  onCancel?: () => void;
  onDismissKeyboard?: () => void;
  onSend: () => void;
}) {
  const primaryForeground = useColor("primary-foreground");

  return (
    <View className="bg-background border-paper-border flex-row items-center justify-between border-b px-4 py-3">
      <ComposerLeadingButton
        onCancel={onCancel}
        onDismissKeyboard={onDismissKeyboard}
      />
      <Text
        className="text-foreground text-[22px]"
        style={{ fontFamily: postalDisplayFont }}
      >
        New message
      </Text>
      <Pressable
        accessibilityLabel="Send email"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSend }}
        className="bg-primary border-brass-soft size-11 items-center justify-center rounded-lg border"
        disabled={!canSend}
        hitSlop={10}
        onPress={onSend}
      >
        <Send color={primaryForeground} opacity={canSend ? 1 : 0.3} size={19} />
      </Pressable>
    </View>
  );
}

function ComposerLeadingButton({
  onCancel,
  onDismissKeyboard,
}: {
  onCancel?: () => void;
  onDismissKeyboard?: () => void;
}) {
  const foreground = useColor("foreground");

  if (onCancel) {
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
  if (!onDismissKeyboard) return <View className="h-[38px] w-[38px]" />;
  return (
    <Pressable
      accessibilityLabel="Dismiss keyboard"
      accessibilityRole="button"
      className="p-2"
      hitSlop={10}
      onPress={onDismissKeyboard}
    >
      <Keyboard color={foreground} size={21} />
    </Pressable>
  );
}
