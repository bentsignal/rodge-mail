import { Pressable, Text, View } from "react-native";
import { Paperclip, X } from "lucide-react-native";

import type { NativeComposerAttachment } from "./use-native-attachments";

export function ComposerAttachmentList({
  attachments,
  onRemove,
}: {
  attachments: NativeComposerAttachment[];
  onRemove: (attachment: NativeComposerAttachment) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <View className="mb-4 gap-2">
      {attachments.map((attachment) => (
        <View
          key={attachment.id}
          className="bg-muted flex-row items-center gap-2 rounded-xl px-3 py-2"
        >
          <Paperclip color="#777777" size={16} />
          <Text className="text-foreground min-w-0 flex-1" numberOfLines={1}>
            {attachment.fileName}
            <Text className="text-muted-foreground text-xs">
              {getAttachmentStatus(attachment)}
            </Text>
          </Text>
          <Pressable
            accessibilityLabel={`Remove ${attachment.fileName}`}
            accessibilityRole="button"
            disabled={attachment.status === "uploading"}
            hitSlop={10}
            onPress={() => onRemove(attachment)}
          >
            <X color="#777777" size={17} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function getAttachmentStatus(attachment: NativeComposerAttachment) {
  if (attachment.status === "uploading") return " · Uploading…";
  if (attachment.status === "error") {
    return ` · ${attachment.error ?? "Failed"}`;
  }
  if (attachment.size < 1024 * 1024) {
    return ` · ${Math.max(1, Math.round(attachment.size / 1024))} KB`;
  }
  return ` · ${(attachment.size / (1024 * 1024)).toFixed(1)} MB`;
}
