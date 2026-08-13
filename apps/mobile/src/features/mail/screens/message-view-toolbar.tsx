import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { Code2, RefreshCw, Sparkles } from "lucide-react-native";

import type { MailMessage } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import type { MessageViewMode } from "./thread-message-body";
import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";

export function MessageViewToolbar({
  message,
  onChange,
  value,
}: {
  message: MailMessage | undefined;
  onChange: (value: MessageViewMode) => void;
  value: MessageViewMode;
}) {
  return (
    <View className="mx-1 flex-row items-center justify-between gap-3">
      <MessageViewSwitch onChange={onChange} value={value} />
      <RegenerateCleanViewButton message={message} />
    </View>
  );
}

function MessageViewSwitch({
  onChange,
  value,
}: {
  onChange: (value: MessageViewMode) => void;
  value: MessageViewMode;
}) {
  const foreground = useColor("foreground");
  const muted = useColor("muted-foreground");
  return (
    <View
      accessibilityLabel="Message view"
      className="bg-well border-well-border flex-row self-start rounded-xl border p-1"
    >
      <MessageViewButton
        color={value === "clean" ? foreground : muted}
        icon={Sparkles}
        label="Clean"
        onPress={() => onChange("clean")}
        selected={value === "clean"}
      />
      <MessageViewButton
        color={value === "original" ? foreground : muted}
        icon={Code2}
        label="Original"
        onPress={() => onChange("original")}
        selected={value === "original"}
      />
    </View>
  );
}

function RegenerateCleanViewButton({
  message,
}: {
  message: MailMessage | undefined;
}) {
  const muted = useColor("muted-foreground");
  const generate = useMutation(api.cleanView.mutations.generate);
  if (!message) return null;
  const isPreparing =
    message.cleanStatus === "pending" || message.cleanStatus === "running";
  const hasCleanView = hasGeneratedCleanView(message);
  return (
    <Pressable
      accessibilityLabel={cleanViewAccessibilityLabel(hasCleanView)}
      accessibilityRole="button"
      className="min-h-10 flex-row items-center gap-1.5 rounded-lg px-2.5"
      disabled={isPreparing}
      onPress={() =>
        void generate({ messageId: toConvexId<"messages">(message.id) })
      }
    >
      <CleanViewActionIcon color={muted} isPreparing={isPreparing} />
      <Text className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
        {cleanViewActionText({ hasCleanView, isPreparing })}
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
  return <RefreshCw color={color} size={15} />;
}

function MessageViewButton({
  color,
  icon: Icon,
  label,
  onPress,
  selected,
}: {
  color: string;
  icon: typeof Sparkles;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={
        selected
          ? "bg-paper flex-row items-center gap-1.5 rounded-lg px-3 py-2"
          : "flex-row items-center gap-1.5 rounded-lg px-3 py-2"
      }
      onPress={onPress}
    >
      <Icon color={color} size={14} />
      <Text className="text-foreground text-xs font-semibold">{label}</Text>
    </Pressable>
  );
}

function hasGeneratedCleanView(message: MailMessage) {
  if (message.cleanStatus === "ready") return true;
  return Boolean(message.cleanedBody?.trim());
}

function cleanViewAccessibilityLabel(hasCleanView: boolean) {
  return hasCleanView ? "Regenerate clean version" : "Generate clean version";
}

function cleanViewActionText(args: {
  hasCleanView: boolean;
  isPreparing: boolean;
}) {
  if (args.isPreparing) return "Working";
  return args.hasCleanView ? "Redo" : "Generate";
}
