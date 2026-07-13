import { Pressable, Text, View } from "react-native";

import type { MailboxBulkAction } from "./mailbox-thread-list";

export function MailboxBulkToolbar({
  actions,
  selectedCount,
}: {
  actions: MailboxBulkAction[];
  selectedCount: number;
}) {
  return (
    <View className="bg-paper border-paper-border h-14 flex-row items-center justify-evenly border-t px-3">
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          className="h-11 items-center justify-center px-3"
          disabled={selectedCount === 0}
          onPress={action.onPress}
        >
          <Text
            className={
              action.destructive
                ? "text-destructive font-semibold"
                : "text-primary font-semibold"
            }
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
