import { Pressable, Text } from "react-native";
import { Paperclip } from "lucide-react-native";

import { useColor } from "~/hooks/use-color";

export function ComposerAttachButton({ onAttach }: { onAttach: () => void }) {
  const mutedForeground = useColor("muted-foreground");

  return (
    <Pressable
      accessibilityHint="Choose photos or files"
      accessibilityLabel="Add attachments"
      accessibilityRole="button"
      className="bg-well border-well-border min-h-12 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3"
      onPress={onAttach}
    >
      <Paperclip color={mutedForeground} size={18} />
      <Text className="text-foreground font-semibold">Add attachment</Text>
    </Pressable>
  );
}
