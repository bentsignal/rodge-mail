import type { LayoutChangeEvent } from "react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAction } from "convex/react";
import { Download, Paperclip } from "lucide-react-native";

import type { MailMessage } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import { normalizeAttachmentFileName } from "@rodge-mail/convex/attachments/constants";

import { PostalSurface } from "~/features/theme/postal-surface";
import { useColor } from "~/hooks/use-color";
import { MobileEmailBody } from "../components/mobile-email-body";
import { toConvexId } from "../lib/convex-id";

export function ThreadMessageBody({
  message,
  onLayout,
}: {
  message: MailMessage;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const downloadAttachment = useAction(api.attachments.actions.download);
  const mutedForeground = useColor("muted-foreground");
  const [downloadingId, setDownloadingId] = useState<string>();

  async function download(attachment: MailMessage["attachments"][number]) {
    if (downloadingId) return;
    setDownloadingId(attachment.id);
    try {
      const { url } = await downloadAttachment({
        attachmentId: toConvexId<"attachments">(attachment.id),
      });
      const fileName =
        normalizeAttachmentFileName(attachment.name) || "attachment";
      const file = await File.downloadFileAsync(
        url,
        new File(Paths.cache, fileName),
        { idempotent: true },
      );
      await Sharing.shareAsync(file.uri, {
        dialogTitle: `Open ${fileName}`,
        mimeType: attachment.contentType,
      });
    } catch (error) {
      Alert.alert("Couldn’t download attachment", getDownloadError(error));
    }
    setDownloadingId(undefined);
  }

  return (
    <PostalSurface
      className="gap-4 rounded-xl px-4 py-5"
      onLayout={onLayout}
      transparent
    >
      <Text className="text-muted-foreground text-xs">
        To: {message.to.map((recipient) => recipient.address).join(", ")}
      </Text>
      <MobileEmailBody messageId={message.id} source={message.body} />
      {message.attachments.map((attachment) => (
        <Pressable
          key={attachment.id}
          accessibilityLabel={`${attachment.name}, ${attachment.size}`}
          accessibilityRole="button"
          className="bg-well border-well-border flex-row items-center gap-3 rounded-xl border px-4 py-3"
          disabled={downloadingId !== undefined}
          onPress={() => void download(attachment)}
        >
          <Paperclip color={mutedForeground} size={18} />
          <View className="min-w-0 flex-1">
            <Text className="text-foreground font-semibold" numberOfLines={1}>
              {attachment.name}
            </Text>
            <Text className="text-muted-foreground text-xs">
              {attachment.size}
            </Text>
          </View>
          <AttachmentDownloadIcon
            isDownloading={downloadingId === attachment.id}
          />
        </Pressable>
      ))}
    </PostalSurface>
  );
}

function AttachmentDownloadIcon({ isDownloading }: { isDownloading: boolean }) {
  const mutedForeground = useColor("muted-foreground");
  if (isDownloading) {
    return <ActivityIndicator color={mutedForeground} size="small" />;
  }
  return <Download color={mutedForeground} size={18} />;
}

function getDownloadError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "This attachment is not available yet.";
}
