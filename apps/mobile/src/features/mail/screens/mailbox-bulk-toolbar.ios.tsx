import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Divider,
  Host,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
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
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const actionWidth = getActionWidth(width, actions.length);
  const tabBarClearance = insets.bottom + 6;

  return (
    <View
      className="bg-paper border-paper-border border-t px-3 pt-1"
      style={{ height: 88 + tabBarClearance, paddingBottom: tabBarClearance }}
    >
      <Host colorScheme={colorScheme} seedColor={primary} style={{ flex: 1 }}>
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[frame({ height: 86, maxWidth: Infinity })]}
        >
          <HStack
            alignment="center"
            modifiers={[
              frame({ height: 30, maxWidth: Infinity }),
              padding({ leading: 8, trailing: 8 }),
            ]}
          >
            <Text
              modifiers={[
                font({ size: 13, weight: "semibold" }),
                foregroundStyle(foreground),
              ]}
            >
              {getSelectionLabel(selectedCount)}
            </Text>
            <Spacer />
            <Text
              modifiers={[
                font({ size: 11, weight: "medium" }),
                foregroundStyle(mutedForeground),
              ]}
            >
              Actions
            </Text>
          </HStack>
          <Divider />
          <HStack
            alignment="center"
            spacing={0}
            modifiers={[frame({ height: 55, maxWidth: Infinity })]}
          >
            {actions.map((action, index) => (
              <NativeToolbarItem
                key={action.label}
                action={action}
                destructiveColor={destructive}
                disabled={selectedCount === 0}
                index={index}
                primary={primary}
                width={actionWidth}
              />
            ))}
          </HStack>
        </VStack>
      </Host>
    </View>
  );
}

function NativeToolbarItem({
  action,
  destructiveColor,
  disabled: isDisabled,
  index,
  primary,
  width,
}: {
  action: MailboxBulkAction;
  destructiveColor: string;
  disabled: boolean;
  index: number;
  primary: string;
  width: number;
}) {
  if (index === 0) {
    return (
      <NativeToolbarAction
        action={action}
        destructiveColor={destructiveColor}
        disabled={isDisabled}
        primary={primary}
        width={width}
      />
    );
  }
  return (
    <>
      <Divider modifiers={[frame({ height: 30 })]} />
      <NativeToolbarAction
        action={action}
        destructiveColor={destructiveColor}
        disabled={isDisabled}
        primary={primary}
        width={width}
      />
    </>
  );
}

function NativeToolbarAction({
  action,
  destructiveColor,
  disabled: isDisabled,
  primary,
  width,
}: {
  action: MailboxBulkAction;
  destructiveColor: string;
  disabled: boolean;
  primary: string;
  width: number;
}) {
  const color = action.destructive ? destructiveColor : primary;
  return (
    <Button
      modifiers={[
        buttonStyle("plain"),
        frame({ height: 54, width }),
        tint(color),
        disabled(isDisabled),
        accessibilityLabel(action.label),
      ]}
      role={action.destructive ? "destructive" : "default"}
      onPress={action.onPress}
    >
      <VStack alignment="center" spacing={3}>
        <Image color={color} size={18} systemName={action.systemImage} />
        <Text
          modifiers={[
            font({ size: 11, weight: "semibold" }),
            foregroundStyle(color),
            lineLimit(1),
          ]}
        >
          {action.label}
        </Text>
      </VStack>
    </Button>
  );
}

function getSelectionLabel(selectedCount: number) {
  if (selectedCount === 1) return "1 selected";
  return `${selectedCount} selected`;
}

function getActionWidth(screenWidth: number, actionCount: number) {
  const horizontalPadding = 24;
  const dividerWidth = Math.max(0, actionCount - 1);
  return (screenWidth - horizontalPadding - dividerWidth) / actionCount;
}
