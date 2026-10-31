import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAction } from "convex/react";
import { Download, Paperclip } from "lucide-react-native";

import type { MailAttachment } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import { normalizeAttachmentFileName } from "@rodge-mail/convex/attachments/constants";

import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";

export function MessageAttachments({
  attachments,
}: {
  attachments: MailAttachment[];
}) {
  const { download, downloadingId } = useAttachmentDownload();
  const mutedForeground = useColor("muted-foreground");
  const files = attachments.filter((attachment) => !attachment.isInline);
  if (files.length === 0) return null;
  return (
    <View className="bg-muted overflow-hidden rounded-xl">
      {files.map((attachment, index) => {
        const fileName = getAttachmentFileName(attachment.name);
        return (
          <Pressable
            key={attachment.id}
            accessibilityLabel={`${fileName}, ${attachment.size}`}
            accessibilityRole="button"
            className="active:bg-accent flex-row items-center gap-3 pl-4"
            disabled={downloadingId !== undefined}
            onPress={() => download(attachment)}
          >
            <Paperclip color={mutedForeground} size={18} />
            <View
              className={`min-w-0 flex-1 flex-row items-center gap-3 py-3 pr-4 ${index > 0 ? "border-border border-t-hairline" : ""}`}
            >
              <View className="min-w-0 flex-1">
                <Text
                  className="text-foreground text-[17px] leading-[22px]"
                  numberOfLines={1}
                >
                  {fileName}
                </Text>
                <Text className="text-muted-foreground text-[13px] leading-[18px]">
                  {attachment.size}
                </Text>
              </View>
              <AttachmentDownloadIcon
                isDownloading={downloadingId === attachment.id}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function useAttachmentDownload() {
  const downloadAttachment = useAction(api.attachments.actions.download);
  const [downloadingId, setDownloadingId] = useState<string>();

  async function download(attachment: MailAttachment) {
    if (downloadingId) return;
    setDownloadingId(attachment.id);
    try {
      const { url } = await downloadAttachment({
        attachmentId: toConvexId<"attachments">(attachment.id),
      });
      const fileName = getAttachmentFileName(attachment.name);
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

  return {
    download: (attachment: MailAttachment) => void download(attachment),
    downloadingId,
  };
}

function getAttachmentFileName(fileName: string) {
  return normalizeAttachmentFileName(fileName) || "attachment";
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
