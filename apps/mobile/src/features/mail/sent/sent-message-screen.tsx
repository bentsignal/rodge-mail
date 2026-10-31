import type { FunctionReturnType } from "convex/server";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { AlertCircle, Check, Clock3, Paperclip } from "lucide-react-native";

import type { api as Api } from "@rodge-mail/convex/api";
import { api } from "@rodge-mail/convex/api";
import {
  formatRecipientAddresses,
  getSentStatusLabel,
  getSentSubject,
} from "@rodge-mail/features/mail";

import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";
import { formatMessageTime } from "../lib/mail-format";
import { useOutgoingMail } from "../outgoing/outgoing-store";

type SentMessage = NonNullable<
  FunctionReturnType<typeof Api.outbox.queries.getSentMessage>
>;

/** The outbox copy of a message: what was sent, to whom, and where it is. */
export function SentMessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const message = useQuery(
    api.outbox.queries.getSentMessage,
    id ? { outboxId: toConvexId<"outboxMessages">(id) } : "skip",
  );
  if (message === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator className="flex-1" />
      </>
    );
  }
  if (!message) {
    return (
      <>
        <Stack.Screen options={{ title: "" }} />
        <Text className="text-muted-foreground py-20 text-center text-base">
          This message is no longer in your outbox.
        </Text>
      </>
    );
  }
  return <SentMessage message={message} />;
}

function SentMessage({ message }: { message: SentMessage }) {
  const router = useRouter();
  const retry = useOutgoingMail((store) => store.retryOutboxMessage);
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Retry sending"
          hidden={message.status !== "failed"}
          icon="arrow.clockwise"
          onPress={() => retry(message._id)}
        />
        <Stack.Toolbar.Button
          accessibilityLabel="Show conversation"
          hidden={!message.threadId}
          icon="bubble.left.and.bubble.right"
          onPress={() => {
            if (!message.threadId) return;
            router.push(
              `/(tabs)/(inbox)/thread/${message.threadId}?messageId=${message.messageId ?? ""}`,
            );
          }}
        />
      </Stack.Toolbar>
      <ScrollView
        contentContainerClassName="gap-5 px-4 pt-2 pb-32"
        contentInsetAdjustmentBehavior="automatic"
        testID="sent-message"
      >
        <View className="gap-3">
          <Text
            className="text-foreground text-[28px] leading-[34px] font-bold"
            selectable
          >
            {getSentSubject(message.subject)}
          </Text>
          <SentStatus message={message} />
        </View>
        <SentHeaders message={message} />
        <Text className="text-foreground text-base leading-6" selectable>
          {message.plainText}
        </Text>
        <SentAttachments attachments={message.attachments} />
      </ScrollView>
    </>
  );
}

function SentStatus({ message }: { message: SentMessage }) {
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  const destructive = useColor("destructive");
  const failed = message.status === "failed";
  const time = formatMessageTime(
    new Date(message.sentAt ?? message.updatedAt).toISOString(),
  );
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-1.5">
        <StatusIcon
          color={
            failed
              ? destructive
              : message.status === "sent"
                ? foreground
                : mutedForeground
          }
          status={message.status}
        />
        <Text
          className={
            failed
              ? "text-destructive text-sm font-semibold"
              : "text-muted-foreground text-sm font-semibold"
          }
        >
          {getSentStatusLabel(message.status)}
        </Text>
        <Text className="text-muted-foreground text-sm">· {time}</Text>
      </View>
      <FailureNote message={message} />
    </View>
  );
}

function FailureNote({ message }: { message: SentMessage }) {
  if (message.status !== "failed" || !message.error) return null;
  return (
    <Text
      className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm leading-5"
      selectable
    >
      {message.error}
    </Text>
  );
}

function StatusIcon({
  color,
  status,
}: {
  color: string;
  status: SentMessage["status"];
}) {
  if (status === "sending") return <ActivityIndicator size="small" />;
  if (status === "failed") return <AlertCircle color={color} size={15} />;
  if (status === "sent") return <Check color={color} size={15} />;
  return <Clock3 color={color} size={15} />;
}

function SentHeaders({ message }: { message: SentMessage }) {
  const rows = [
    { label: "From", value: message.account.address },
    { label: "To", value: formatRecipientAddresses(message.to) },
    { label: "Cc", value: formatRecipientAddresses(message.cc) },
    { label: "Bcc", value: formatRecipientAddresses(message.bcc) },
  ].filter((row) => row.value);
  return (
    <View className="bg-muted rounded-xl px-3.5 py-1">
      {rows.map((row, index) => (
        <HeaderRow
          key={row.label}
          divider={index < rows.length - 1}
          label={row.label}
          value={row.value}
        />
      ))}
    </View>
  );
}

function HeaderRow({
  divider,
  label,
  value,
}: {
  divider: boolean;
  label: string;
  value: string;
}) {
  return (
    <View
      className={
        divider
          ? "border-border flex-row gap-3 border-b-[0.5px] py-2.5"
          : "flex-row gap-3 py-2.5"
      }
    >
      <Text className="text-muted-foreground w-11 text-[15px]">{label}</Text>
      <Text className="text-foreground min-w-0 flex-1 text-[15px]" selectable>
        {value}
      </Text>
    </View>
  );
}

function SentAttachments({
  attachments,
}: {
  attachments: SentMessage["attachments"];
}) {
  const mutedForeground = useColor("muted-foreground");
  if (attachments.length === 0) return null;
  return (
    <View className="gap-2">
      {attachments.map((attachment) => (
        <Pressable
          key={attachment.fileName}
          accessibilityLabel={attachment.fileName}
          accessibilityRole={attachment.url ? "link" : "text"}
          className="bg-muted h-14 flex-row items-center gap-3 rounded-xl px-3.5"
          disabled={!attachment.url}
          onPress={() => {
            if (attachment.url) void Linking.openURL(attachment.url);
          }}
        >
          <Paperclip color={mutedForeground} size={17} />
          <View className="min-w-0 flex-1">
            <Text className="text-foreground text-[15px]" numberOfLines={1}>
              {attachment.fileName}
            </Text>
            <Text className="text-muted-foreground text-xs">
              {formatSize(attachment.size)}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
