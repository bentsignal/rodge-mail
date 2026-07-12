import { Pressable, Text } from "react-native";
import { Paperclip } from "lucide-react-native";

import { PostalWell } from "~/features/theme/postal-surface";
import { useColor } from "~/hooks/use-color";

export function ComposerAttachButton({ onAttach }: { onAttach: () => void }) {
  const mutedForeground = useColor("muted-foreground");

  return (
    <PostalWell>
      <Pressable
        accessibilityLabel="Add attachments"
        accessibilityRole="button"
        className="min-h-11 flex-row items-center justify-center gap-2 rounded-lg py-3"
        onPress={onAttach}
      >
        <Paperclip color={mutedForeground} size={18} />
        <Text className="text-foreground font-semibold">Attach</Text>
      </Pressable>
    </PostalWell>
  );
}
