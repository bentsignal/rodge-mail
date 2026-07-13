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
    <View className="bg-paper border-paper-border border-t px-3 pb-2">
      <View className="border-paper-border h-9 flex-row items-center border-b px-2">
        <Text className="text-foreground text-sm font-semibold">
          {getSelectionLabel(selectedCount)}
        </Text>
        <Text className="text-muted-foreground ml-auto text-xs font-medium">
          Actions
        </Text>
      </View>
      <View className="h-14 flex-row items-center">
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            className="border-paper-border h-10 flex-1 items-center justify-center border-r px-2 last:border-r-0"
            disabled={selectedCount === 0}
            onPress={action.onPress}
          >
            <Text
              className={
                action.destructive
                  ? "text-destructive text-sm font-semibold"
                  : "text-primary text-sm font-semibold"
              }
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function getSelectionLabel(selectedCount: number) {
  if (selectedCount === 1) return "1 selected";
  return `${selectedCount} selected`;
}
