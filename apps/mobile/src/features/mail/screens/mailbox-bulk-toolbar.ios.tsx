import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Host, HStack, Spacer } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  disabled,
  frame,
  labelStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import type { MailboxBulkAction } from "./mailbox-thread-list";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";

export function MailboxBulkToolbar({
  actions,
  selectedCount,
}: {
  actions: MailboxBulkAction[];
  selectedCount: number;
}) {
  const colorScheme = useResolvedMobileColorScheme();
  const destructive = useColor("destructive");
  const primary = useColor("primary");
  const insets = useSafeAreaInsets();
  const tabBarClearance = insets.bottom + 6;

  return (
    <View
      className="bg-paper border-paper-border border-t px-4 pt-1"
      style={{ height: 56 + tabBarClearance, paddingBottom: tabBarClearance }}
    >
      <Host colorScheme={colorScheme} seedColor={primary} style={{ flex: 1 }}>
        <HStack
          alignment="center"
          modifiers={[frame({ height: 48, maxWidth: Infinity })]}
        >
          <Spacer />
          {actions.map((action) => (
            <NativeToolbarAction
              key={action.label}
              action={action}
              destructiveColor={destructive}
              disabled={selectedCount === 0}
              primary={primary}
            />
          ))}
          <Spacer />
        </HStack>
      </Host>
    </View>
  );
}

function NativeToolbarAction({
  action,
  destructiveColor,
  disabled: isDisabled,
  primary,
}: {
  action: MailboxBulkAction;
  destructiveColor: string;
  disabled: boolean;
  primary: string;
}) {
  return (
    <>
      <Button
        modifiers={[
          buttonStyle("plain"),
          frame({ height: 44, width: 56 }),
          labelStyle("iconOnly"),
          tint(action.destructive ? destructiveColor : primary),
          disabled(isDisabled),
          accessibilityLabel(action.label),
        ]}
        label={action.label}
        role={action.destructive ? "destructive" : "default"}
        systemImage={action.systemImage}
        onPress={action.onPress}
      />
      <Spacer />
    </>
  );
}
