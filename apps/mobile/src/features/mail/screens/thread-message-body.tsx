import type { LayoutChangeEvent } from "react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { WebView } from "@expo/dom-webview";
import { useAction } from "convex/react";

import type { MailAttachment, MailMessage } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { MobileEmailBody } from "../components/mobile-email-body";
import { toConvexId } from "../lib/convex-id";
import { formatMessageTime } from "../lib/mail-format";
import { openEmailLink } from "../lib/open-email-link";
import {
  createOriginalHtmlDocument,
  parseOriginalHtmlMessage,
} from "../lib/original-html-document";
import { MessageAttachments } from "./message-attachments";
import { SwitchedContent } from "./switched-content";

export type MessageViewMode = "clean" | "original";

export function ThreadMessageBody({
  message,
  onLayout,
  showSeparator,
  viewMode,
}: {
  message: MailMessage;
  onLayout?: (event: LayoutChangeEvent) => void;
  showSeparator: boolean;
  viewMode: MessageViewMode;
}) {
  return (
    <View
      className={
        showSeparator
          ? "border-border border-t-hairline gap-4 pt-5"
          : "gap-4 pt-1"
      }
      onLayout={onLayout}
    >
      <MessageHeader message={message} />
      <MessageContent message={message} viewMode={viewMode} />
      <MessageAttachments attachments={message.attachments} />
    </View>
  );
}

function MessageHeader({ message }: { message: MailMessage }) {
  const senderName = message.from.name || message.from.address;
  return (
    <View className="flex-row items-start gap-3">
      <View className="bg-muted size-10 items-center justify-center rounded-full">
        <Text className="text-foreground text-[17px] font-semibold">
          {senderName.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-baseline gap-2">
          <Text
            className="text-foreground min-w-0 flex-1 text-[17px] leading-[22px] font-semibold"
            numberOfLines={1}
          >
            {senderName}
          </Text>
          <Text className="text-muted-foreground text-[15px] leading-5">
            {formatMessageTime(message.sentAt)}
          </Text>
        </View>
        <Text
          className="text-muted-foreground text-[15px] leading-5"
          numberOfLines={2}
        >
          {formatRecipients(message)}
        </Text>
      </View>
    </View>
  );
}

function formatRecipients(message: MailMessage) {
  const to = `To: ${names(message.to)}`;
  if (message.cc.length === 0) return to;
  return `${to}  Cc: ${names(message.cc)}`;
}

function names(addresses: MailMessage["to"]) {
  return addresses.map((address) => address.name || address.address).join(", ");
}

function MessageContent({
  message,
  viewMode,
}: {
  message: MailMessage;
  viewMode: MessageViewMode;
}) {
  const originalHtml = getUsableOriginalHtml(message.originalHtml);
  if (!originalHtml) {
    return <ReadableBody message={message} viewMode={viewMode} />;
  }
  return (
    <SwitchedContent
      clean={<ReadableBody message={message} viewMode="clean" />}
      renderOriginal={(onReady) => (
        <OriginalHtml
          attachments={message.attachments}
          html={originalHtml}
          onReady={onReady}
        />
      )}
      viewMode={viewMode}
    />
  );
}

function ReadableBody({
  message,
  viewMode,
}: {
  message: MailMessage;
  viewMode: MessageViewMode;
}) {
  return (
    <View className="gap-3">
      <OriginalUnavailableNotice viewMode={viewMode} />
      <MobileEmailBody
        markdown={viewMode === "clean"}
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
    <Text className="text-muted-foreground text-[13px] leading-[18px]">
      Original HTML is not available for this older message. Showing its
      extracted text.
    </Text>
  );
}

function OriginalHtml({
  attachments,
  html,
  onReady,
}: {
  attachments: MailAttachment[];
  html: string;
  onReady: () => void;
}) {
  const background = "#ffffff";
  const foreground = "#18181b";
  const [height, setHeight] = useState(420);
  const inlineImages = useInlineImageUrls(attachments);
  const document = createOriginalHtmlDocument({
    background,
    foreground,
    html,
    inlineImageUrls: inlineImages.urls,
  });
  if (inlineImages.isResolving) {
    return (
      <View className="h-60 items-center justify-center">
        <ActivityIndicator size="small" />
      </View>
    );
  }
  return (
    <WebView
      automaticallyAdjustContentInsets={false}
      bounces={false}
      containerStyle={{ backgroundColor: background, borderRadius: 12 }}
      originWhitelist={["*"]}
      onMessage={(event) => {
        const message = parseOriginalHtmlMessage(event.nativeEvent.data);
        if (message?.type === "link") void openEmailLink(message.url);
        if (message?.type === "height") {
          setHeight(Math.max(240, Math.min(2_400, message.height)));
          onReady();
        }
      }}
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      source={{
        uri: `data:text/html;charset=utf-8,${encodeURIComponent(document)}`,
      }}
      style={{ alignSelf: "stretch", backgroundColor: background, height }}
      useExpoModulesBridge={false}
    />
  );
}

function useInlineImageUrls(attachments: MailAttachment[]) {
  const downloadAttachment = useAction(api.attachments.actions.download);
  const key = attachments
    .filter((attachment) => attachment.contentId)
    .map((attachment) => attachment.id)
    .sort()
    .join(":");
  const [result, setResult] = useState<{
    key: string;
    urls: Record<string, string>;
  }>({ key: "", urls: {} });

  // eslint-disable-next-line no-restricted-syntax -- Resolving provider-backed CID images is an external asynchronous synchronization.
  useEffect(() => {
    let active = true;
    if (!key) return;
    const inlineAttachments = attachments.filter(
      (attachment) => attachment.contentId,
    );
    void Promise.all(
      inlineAttachments.map(async (attachment) => {
        try {
          const { url } = await downloadAttachment({
            attachmentId: toConvexId<"attachments">(attachment.id),
          });
          return attachment.contentId
            ? ([attachment.contentId, url] as const)
            : null;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (!active) return;
      setResult({
        key,
        urls: Object.fromEntries(entries.filter((entry) => entry !== null)),
      });
    });
    return () => {
      active = false;
    };
  }, [attachments, downloadAttachment, key]);

  if (!key) return { isResolving: false, urls: {} };
  return { isResolving: result.key !== key, urls: result.urls };
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
