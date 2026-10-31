import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Check, Copy } from "lucide-react-native";

import type { MailMessage } from "@rodge-mail/features/mail";

import type { MessageViewMode } from "./thread-message-body";
import { useColor } from "~/hooks/use-color";

export function CleanViewCodeCard({
  code,
  viewMode,
}: {
  code: MailMessage["cleanCode"];
  viewMode: MessageViewMode;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const foreground = useColor("foreground");
  if (viewMode !== "clean" || !code) return null;
  const codeValue = code.value;
  const copyLabel = copied ? "Copied" : "Copy";

  function copyCode() {
    setCopied(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void Clipboard.setStringAsync(codeValue);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <View className="bg-muted flex-row items-center gap-4 rounded-xl py-3 pr-2 pl-4">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-muted-foreground text-[13px] leading-[18px]">
          {code.label || "Code"}
        </Text>
        <Text
          className="text-foreground font-mono text-[28px] leading-[34px] font-semibold tracking-[3px]"
          selectable
        >
          {code.value}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={copied ? "Copied" : `Copy ${code.label || "code"}`}
        accessibilityRole="button"
        className="min-h-11 flex-row items-center gap-1.5 rounded-lg px-3 active:opacity-50"
        hitSlop={8}
        onPress={copyCode}
      >
        <CopyIcon color={foreground} copied={copied} />
        <Text className="text-foreground text-[17px] leading-[22px]">
          {copyLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function CopyIcon({ color, copied }: { color: string; copied: boolean }) {
  if (copied) return <Check color={color} size={17} strokeWidth={2.5} />;
  return <Copy color={color} size={17} />;
}
