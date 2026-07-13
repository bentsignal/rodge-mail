import type { LayoutChangeEvent } from "react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { WebView } from "@expo/dom-webview";
import { useAction } from "convex/react";
import { Download, Paperclip } from "lucide-react-native";

import type { MailAttachment, MailMessage } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import { normalizeAttachmentFileName } from "@rodge-mail/convex/attachments/constants";

import { PostalSurface } from "~/features/theme/postal-surface";
import { useColor } from "~/hooks/use-color";
import { MobileEmailBody } from "../components/mobile-email-body";
import { toConvexId } from "../lib/convex-id";
import { MessageOverview } from "./clean-view-overview";

export type MessageViewMode = "clean" | "original";

export function ThreadMessageBody({
  message,
  onLayout,
  viewMode,
}: {
  message: MailMessage;
  onLayout?: (event: LayoutChangeEvent) => void;
  viewMode: MessageViewMode;
}) {
  const attachmentDownload = useAttachmentDownload();
  return (
    <PostalSurface
      className="gap-4 rounded-xl px-4 py-5"
      onLayout={onLayout}
      transparent
    >
      <Text className="text-muted-foreground text-xs">
        To: {message.to.map((recipient) => recipient.address).join(", ")}
      </Text>
      <MessageOverview message={message} />
      <MessageContent message={message} viewMode={viewMode} />
      <MessageAttachments
        attachments={message.attachments}
        downloadingId={attachmentDownload.downloadingId}
        onDownload={attachmentDownload.download}
      />
    </PostalSurface>
  );
}

function MessageContent({
  message,
  viewMode,
}: {
  message: MailMessage;
  viewMode: MessageViewMode;
}) {
  const originalHtml = getUsableOriginalHtml(message.originalHtml);
  if (viewMode === "original" && originalHtml) {
    return <OriginalHtml html={originalHtml} />;
  }
  return (
    <View className="gap-3">
      <OriginalUnavailableNotice viewMode={viewMode} />
      <MobileEmailBody
        messageId={message.id}
        source={getReadableBody(message, viewMode)}
      />
    </View>
  );
}

function OriginalUnavailableNotice({
  viewMode,
}: {
  viewMode: MessageViewMode;
}) {
  if (viewMode !== "original") return null;
  return (
    <Text className="text-muted-foreground text-xs leading-4">
      Original HTML is not available for this older message. Showing its
      extracted text.
    </Text>
  );
}

function MessageAttachments({
  attachments,
  downloadingId,
  onDownload,
}: {
  attachments: MailAttachment[];
  downloadingId: string | undefined;
  onDownload: (attachment: MailAttachment) => void;
}) {
  const mutedForeground = useColor("muted-foreground");
  return attachments.map((attachment) => {
    const fileName = getAttachmentFileName(attachment.name);
    return (
      <Pressable
        key={attachment.id}
        accessibilityLabel={`${fileName}, ${attachment.size}`}
        accessibilityRole="button"
        className="bg-well border-well-border flex-row items-center gap-3 rounded-xl border px-4 py-3"
        disabled={downloadingId !== undefined}
        onPress={() => onDownload(attachment)}
      >
        <Paperclip color={mutedForeground} size={18} />
        <View className="min-w-0 flex-1">
          <Text className="text-foreground font-semibold" numberOfLines={1}>
            {fileName}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {attachment.size}
          </Text>
        </View>
        <AttachmentDownloadIcon
          isDownloading={downloadingId === attachment.id}
        />
      </Pressable>
    );
  });
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

function OriginalHtml({ html }: { html: string }) {
  const background = "#ffffff";
  const foreground = "#18181b";
  const [height, setHeight] = useState(420);
  const document = createHtmlDocument({ background, foreground, html });
  return (
    <WebView
      automaticallyAdjustContentInsets={false}
      bounces={false}
      containerStyle={{ backgroundColor: background, borderRadius: 12 }}
      onMessage={(event) => {
        const nextHeight = Number(event.nativeEvent.data);
        if (Number.isFinite(nextHeight)) {
          setHeight(Math.max(240, Math.min(2_400, nextHeight)));
        }
      }}
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      source={{
        uri: `data:text/html;charset=utf-8,${encodeURIComponent(document)}`,
      }}
      style={{ backgroundColor: background, height }}
      useExpoModulesBridge={false}
    />
  );
}

function createHtmlDocument({
  background,
  foreground,
  html,
}: {
  background: string;
  foreground: string;
  html: string;
}) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;padding:0;background:${background};color:${foreground};font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;line-height:1.55;overflow-wrap:anywhere}img,table{max-width:100%!important;height:auto}a{color:#9a6b16}</style></head><body>${html}<script>new ResizeObserver(()=>window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight+8))).observe(document.body)</script></body></html>`;
}

function getUsableOriginalHtml(html: string | undefined) {
  const normalized = html?.trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return undefined;
  }
  return normalized;
}

function getReadableBody(message: MailMessage, viewMode: MessageViewMode) {
  const cleanBody = message.cleanedBody?.trim();
  if (
    viewMode === "clean" &&
    cleanBody &&
    cleanBody !== "undefined" &&
    cleanBody !== "null"
  ) {
    return cleanBody;
  }
  return message.body.filter(
    (line) => line.trim() !== "undefined" && line.trim() !== "null",
  );
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
