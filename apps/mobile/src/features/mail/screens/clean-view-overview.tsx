import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { ShieldAlert, Sparkles } from "lucide-react-native";

import type { MailMessage } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";

export function MessageOverview({ message }: { message: MailMessage }) {
  const brass = useColor("primary");
  const label = message.isSpam ? "Likely spam" : "Overview";
  const isPreparing =
    message.cleanStatus === "pending" || message.cleanStatus === "running";
  const hasCleanView = hasGeneratedCleanView(message);
  const overview = getOverviewText(message.overview, isPreparing);
  return (
    <View className="bg-well border-well-border flex-row gap-3 rounded-xl border px-4 py-3">
      <OverviewIcon color={brass} isSpam={message.isSpam === true} />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
          {label}
        </Text>
        <Text className="text-foreground text-sm leading-5">{overview}</Text>
        <CleanViewError message={message} />
        <CleanViewAction
          hasCleanView={hasCleanView}
          isPreparing={isPreparing}
          messageId={message.id}
        />
      </View>
    </View>
  );
}

function CleanViewError({ message }: { message: MailMessage }) {
  if (message.cleanStatus !== "failed") return null;
  return (
    <Text className="text-destructive text-xs leading-4">
      {formatCleanViewError(message.cleanError)}
    </Text>
  );
}

function CleanViewAction({
  hasCleanView,
  isPreparing,
  messageId,
}: {
  hasCleanView: boolean;
  isPreparing: boolean;
  messageId: string;
}) {
  if (hasCleanView) return null;
  return (
    <GenerateCleanViewButton isPreparing={isPreparing} messageId={messageId} />
  );
}

function GenerateCleanViewButton({
  isPreparing,
  messageId,
}: {
  isPreparing: boolean;
  messageId: string;
}) {
  const muted = useColor("muted-foreground");
  const generate = useMutation(api.cleanView.mutations.generate);
  return (
    <Pressable
      accessibilityRole="button"
      className="bg-background border-border mt-1 flex-row items-center self-start rounded-lg border px-3 py-2"
      disabled={isPreparing}
      onPress={() =>
        void generate({ messageId: toConvexId<"messages">(messageId) })
      }
    >
      <CleanViewActionIcon color={muted} isPreparing={isPreparing} />
      <Text className="text-muted-foreground ml-2 text-[10px] font-bold tracking-wider uppercase">
        {cleanViewActionLabel(isPreparing)}
      </Text>
    </Pressable>
  );
}

function CleanViewActionIcon({
  color,
  isPreparing,
}: {
  color: string;
  isPreparing: boolean;
}) {
  if (isPreparing) return <ActivityIndicator color={color} size="small" />;
  return <Sparkles color={color} size={13} />;
}

function OverviewIcon({ color, isSpam }: { color: string; isSpam: boolean }) {
  if (isSpam) return <ShieldAlert color={color} size={16} />;
  return <Sparkles color={color} size={16} />;
}

function getOverviewText(value: string | undefined, isPreparing: boolean) {
  if (value?.trim()) return value;
  if (isPreparing) return "Generating a clean overview and reader view…";
  return "Generate a clean overview and reader view when you want one.";
}

function cleanViewActionLabel(isPreparing: boolean) {
  if (isPreparing) return "Generating";
  return "Generate clean version";
}

function hasGeneratedCleanView(message: MailMessage) {
  if (message.cleanStatus === "ready") return true;
  if (message.overview?.trim()) return true;
  return Boolean(message.cleanedBody?.trim());
}

function formatCleanViewError(error: string | undefined) {
  if (error?.includes("Daily AI limit reached")) {
    return "Today’s $1 AI limit has been reached. Try again after the UTC reset.";
  }
  return "The clean view couldn’t be generated. You can try again.";
}
