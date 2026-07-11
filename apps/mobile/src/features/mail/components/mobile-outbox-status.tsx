import type { FunctionReturnType } from "convex/server";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import {
  CircleAlert,
  CircleCheck,
  Clock3,
  RotateCcw,
} from "lucide-react-native";

import { api } from "@rodge-mail/convex/api";

type OutboxItem = FunctionReturnType<
  typeof api.outbox.queries.listRecent
>[number];

export function MobileOutboxStatus() {
  const outboxes = useQuery(api.outbox.queries.listRecent, {});
  if (!outboxes || outboxes.length === 0) return null;

  return (
    <View className="gap-2">
      <Text className="text-muted-foreground px-2 text-xs font-semibold tracking-wider uppercase">
        Delivery
      </Text>
      <View className="bg-muted/60 border-border overflow-hidden rounded-2xl border">
        {outboxes.map((outbox) => (
          <OutboxRow key={outbox._id} outbox={outbox} />
        ))}
      </View>
    </View>
  );
}

function OutboxRow({ outbox }: { outbox: OutboxItem }) {
  const retryOutbox = useMutation(api.mail.mutations.retryOutbox);
  const retryInFlight = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  async function retry() {
    if (outbox.status !== "failed" || retryInFlight.current) return;
    retryInFlight.current = true;
    setIsRetrying(true);
    try {
      await retryOutbox({ outboxId: outbox._id });
    } catch (error) {
      Alert.alert("Couldn’t retry this message", getErrorMessage(error));
    }
    retryInFlight.current = false;
    setIsRetrying(false);
  }

  return (
    <View className="border-border border-b px-4 py-3 last:border-b-0">
      <View className="flex-row items-start gap-3">
        <StatusIcon status={outbox.status} />
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-baseline gap-2">
            <Text
              className="text-foreground min-w-0 flex-1 text-sm font-semibold"
              numberOfLines={1}
            >
              {outbox.subject.trim() || "(no subject)"}
            </Text>
            <Text className="text-muted-foreground text-xs">
              {formatStatusTime(outbox)}
            </Text>
          </View>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            To {formatRecipients(outbox.to)} · {outbox.account.address}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Text
              accessibilityLiveRegion="polite"
              className={getStatusClassName(outbox.status)}
            >
              {getStatusLabel(outbox.status)}
            </Text>
            <RetryButton
              isRetrying={isRetrying}
              status={outbox.status}
              onPress={() => void retry()}
            />
          </View>
          <OutboxError error={outbox.error} status={outbox.status} />
        </View>
      </View>
    </View>
  );
}

function RetryButton({
  isRetrying,
  onPress,
  status,
}: {
  isRetrying: boolean;
  onPress: () => void;
  status: OutboxItem["status"];
}) {
  if (status !== "failed") return null;
  return (
    <Pressable
      accessibilityRole="button"
      className="border-destructive/30 ml-auto flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 disabled:opacity-50"
      disabled={isRetrying}
      onPress={onPress}
    >
      <RetryIcon isRetrying={isRetrying} />
      <Text className="text-destructive text-xs font-semibold">Retry</Text>
    </Pressable>
  );
}

function RetryIcon({ isRetrying }: { isRetrying: boolean }) {
  if (isRetrying) return <ActivityIndicator color="#d77a55" size="small" />;
  return <RotateCcw color="#d77a55" size={13} />;
}

function StatusIcon({ status }: { status: OutboxItem["status"] }) {
  if (status === "sending") {
    return <ActivityIndicator color="#777777" />;
  }
  if (status === "sent") return <CircleCheck color="#397367" size={20} />;
  if (status === "failed") return <CircleAlert color="#c95d3f" size={20} />;
  return <Clock3 color="#777777" size={20} />;
}

function OutboxError({
  error,
  status,
}: {
  error: string | undefined;
  status: OutboxItem["status"];
}) {
  if (status !== "failed" || !error) return null;
  return (
    <Text className="text-destructive bg-destructive/8 mt-1 rounded-lg px-2.5 py-2 text-xs leading-4">
      {error}
    </Text>
  );
}

function getStatusLabel(status: OutboxItem["status"]) {
  if (status === "pending") return "Queued";
  if (status === "sending") return "Sending";
  if (status === "failed") return "Failed";
  return "Sent";
}

function getStatusClassName(status: OutboxItem["status"]) {
  if (status === "failed") return "text-destructive text-xs font-semibold";
  if (status === "sent") return "text-secondary text-xs font-semibold";
  return "text-muted-foreground text-xs font-semibold";
}

function formatRecipients(recipients: OutboxItem["to"]) {
  return recipients.map((recipient) => recipient.address).join(", ");
}

function formatStatusTime(outbox: OutboxItem) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(outbox.sentAt ?? outbox.updatedAt));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not retry this message.";
}
