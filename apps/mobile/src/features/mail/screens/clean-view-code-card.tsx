import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
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
  const primary = useColor("primary");
  if (viewMode !== "clean" || !code) return null;
  const codeValue = code.value;

  async function copyCode() {
    await Clipboard.setStringAsync(codeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <View className="bg-well border-primary/30 mx-1 flex-row items-center gap-4 rounded-xl border px-4 py-4">
      <View className="min-w-0 flex-1 justify-center gap-1">
        <Text className="text-muted-foreground text-[10px] leading-[14px] font-bold tracking-widest uppercase">
          {code.label || "Code"}
        </Text>
        <Text
          className="text-foreground text-[28px] leading-[34px] font-bold tracking-[4px]"
          selectable
        >
          {code.value}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={copied ? "Code copied" : `Copy ${code.label}`}
        accessibilityRole="button"
        accessibilityState={{ selected: copied }}
        className="bg-paper border-well-border h-11 flex-row items-center justify-center gap-2 self-center rounded-lg border px-3.5"
        onPress={() => void copyCode()}
      >
        <CodeCopyIcon color={primary} copied={copied} />
        <Text className="text-foreground text-xs leading-4 font-semibold">
          <CopyLabel copied={copied} />
        </Text>
      </Pressable>
    </View>
  );
}

function CopyLabel({ copied }: { copied: boolean }) {
  if (copied) return "Copied";
  return "Copy";
}

function CodeCopyIcon({ color, copied }: { color: string; copied: boolean }) {
  if (copied) return <Check color={color} size={16} />;
  return <Copy color={color} size={16} />;
}
