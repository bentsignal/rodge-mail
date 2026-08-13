import { Pressable, Text, View } from "react-native";
import {
  Archive,
  ArchiveRestore,
  MailX,
  Pin,
  Trash2,
} from "lucide-react-native";

import type { MobileMailbox } from "../store";
import { useColor } from "~/hooks/use-color";

export function ThreadReaderFooter({
  isPinned,
  mailbox,
  onArchive,
  onDelete,
  onPin,
  onRestore,
  onUnsubscribe,
  unsubscribeName,
}: {
  isPinned: boolean;
  mailbox: MobileMailbox;
  onArchive: () => void;
  onDelete: () => void;
  onPin: () => void;
  onRestore: () => void;
  onUnsubscribe: () => void;
  unsubscribeName?: string;
}) {
  if (mailbox === "archive") {
    return <ArchiveFooter onDelete={onDelete} onRestore={onRestore} />;
  }
  if (mailbox === "spam") return null;
  return (
    <InboxFooter
      isPinned={isPinned}
      onArchive={onArchive}
      onPin={onPin}
      onUnsubscribe={onUnsubscribe}
      unsubscribeName={unsubscribeName}
    />
  );
}

function ArchiveFooter({
  onDelete,
  onRestore,
}: {
  onDelete: () => void;
  onRestore: () => void;
}) {
  const destructive = useColor("destructive");
  const foreground = useColor("foreground");
  return (
    <View className="mt-1 flex-row gap-2">
      <ThreadFooterButton
        icon={<ArchiveRestore color={foreground} size={18} />}
        label="Restore"
        onPress={onRestore}
      />
      <ThreadFooterButton
        color={destructive}
        icon={<Trash2 color={destructive} size={18} />}
        label="Delete"
        onPress={onDelete}
      />
    </View>
  );
}

function InboxFooter({
  isPinned,
  onArchive,
  onPin,
  onUnsubscribe,
  unsubscribeName,
}: {
  isPinned: boolean;
  onArchive: () => void;
  onPin: () => void;
  onUnsubscribe: () => void;
  unsubscribeName?: string;
}) {
  const foreground = useColor("foreground");
  return (
    <View className="mt-1 gap-2">
      <UnsubscribeFooterButton
        color={foreground}
        name={unsubscribeName}
        onPress={onUnsubscribe}
      />
      <View className="flex-row gap-2">
        <ThreadFooterButton
          icon={
            <Pin
              color={foreground}
              fill={isPinned ? foreground : "transparent"}
              size={18}
            />
          }
          label={isPinned ? "Unpin" : "Pin"}
          onPress={onPin}
        />
        <ThreadFooterButton
          icon={<Archive color={foreground} size={18} />}
          label="Archive"
          onPress={onArchive}
        />
      </View>
    </View>
  );
}

function UnsubscribeFooterButton({
  color,
  name,
  onPress,
}: {
  color: string;
  name: string | undefined;
  onPress: () => void;
}) {
  if (!name) return null;
  return (
    <ThreadFooterButton
      icon={<MailX color={color} size={18} />}
      label={`Unsubscribe from ${name}`}
      onPress={onPress}
    />
  );
}

function ThreadFooterButton({
  color,
  icon,
  label,
  onPress,
}: {
  color?: string;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} thread`}
      accessibilityRole="button"
      className="border-paper-border bg-paper flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 active:opacity-70"
      onPress={onPress}
    >
      <View className="shrink-0">{icon}</View>
      <Text
        className="text-foreground min-w-0 shrink text-center text-sm font-semibold"
        style={color ? { color } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}
