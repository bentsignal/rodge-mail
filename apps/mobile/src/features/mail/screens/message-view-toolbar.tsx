import { ActivityIndicator, View } from "react-native";
import { SegmentedControl } from "@expo/ui/community/segmented-control";

import type { MailMessage } from "@rodge-mail/features/mail";

import type { MessageViewMode } from "./thread-message-body";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import { isPreparingCleanView } from "./clean-view-status";

const MESSAGE_VIEW_MODES = [
  { label: "Clean", value: "clean" },
  { label: "Original", value: "original" },
] as const satisfies readonly { label: string; value: MessageViewMode }[];

export function MessageViewToolbar({
  message,
  onChange,
  value,
}: {
  message: MailMessage | undefined;
  onChange: (value: MessageViewMode) => void;
  value: MessageViewMode;
}) {
  const colorScheme = useResolvedMobileColorScheme();
  return (
    <View className="flex-row items-center gap-3">
      <SegmentedControl
        appearance={colorScheme}
        selectedIndex={MESSAGE_VIEW_MODES.findIndex(
          (mode) => mode.value === value,
        )}
        style={{ flex: 1 }}
        values={MESSAGE_VIEW_MODES.map((mode) => mode.label)}
        onChange={(event) => {
          const mode =
            MESSAGE_VIEW_MODES[event.nativeEvent.selectedSegmentIndex];
          if (mode) onChange(mode.value);
        }}
      />
      <CleanViewProgress message={message} />
    </View>
  );
}

function CleanViewProgress({ message }: { message: MailMessage | undefined }) {
  const mutedForeground = useColor("muted-foreground");
  if (!message || !isPreparingCleanView(message)) return null;
  return (
    <ActivityIndicator
      accessibilityLabel="Preparing clean version"
      color={mutedForeground}
      size="small"
    />
  );
}
