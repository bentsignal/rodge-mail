import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { FileText, Image as ImageIcon, X } from "lucide-react-native";

import type { NativeComposerAttachment } from "./use-native-attachments";
import { useColor } from "~/hooks/use-color";

/** A horizontal strip of compact attachment chips under the subject. */
export function ComposerAttachmentList({
  attachments,
  onRemove,
}: {
  attachments: NativeComposerAttachment[];
  onRemove: (attachment: NativeComposerAttachment) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <View className="border-border ml-4 border-b-[0.5px]">
      <ScrollView
        horizontal
        contentContainerClassName="gap-2 py-2.5 pr-4"
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {attachments.map((attachment) => (
          <AttachmentChip
            key={attachment.id}
            attachment={attachment}
            onRemove={() => onRemove(attachment)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: NativeComposerAttachment;
  onRemove: () => void;
}) {
  const mutedForeground = useColor("muted-foreground");
  const destructive = useColor("destructive");
  const Icon = attachment.contentType.startsWith("image/") ? ImageIcon : FileText;
  const failed = attachment.status === "error";

  return (
    <View className="bg-muted border-border h-11 max-w-60 flex-row items-center gap-2 rounded-xl border-[0.5px] pr-1 pl-2.5">
      <AttachmentLeading
        icon={<Icon color={failed ? destructive : mutedForeground} size={18} />}
        uploading={attachment.status === "uploading"}
      />
      <View className="min-w-0 shrink">
        <Text
          className="text-foreground text-[13px] font-medium"
          numberOfLines={1}
        >
          {attachment.fileName}
        </Text>
        <Text
          className={
            failed
              ? "text-destructive text-[11px]"
              : "text-muted-foreground text-[11px]"
          }
          numberOfLines={1}
        >
          {getAttachmentStatus(attachment)}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={`Remove ${attachment.fileName}`}
        accessibilityRole="button"
        className="size-8 items-center justify-center"
        disabled={attachment.status === "uploading"}
        hitSlop={6}
        onPress={onRemove}
      >
        <X color={mutedForeground} size={15} />
      </Pressable>
    </View>
  );
}

function AttachmentLeading({
  icon,
  uploading,
}: {
  icon: React.ReactNode;
  uploading: boolean;
}) {
  if (uploading) return <ActivityIndicator size="small" />;
  return icon;
}

function getAttachmentStatus(attachment: NativeComposerAttachment) {
  if (attachment.status === "uploading") return "Uploading…";
  if (attachment.status === "error") return attachment.error ?? "Failed";
  if (attachment.size < 1024 * 1024) {
    return `${Math.max(1, Math.round(attachment.size / 1024))} KB`;
  }
  return `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`;
}
