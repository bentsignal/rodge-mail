import { Pressable, Text, View } from "react-native";
import { Archive, ArchiveRestore, Pin, Trash2 } from "lucide-react-native";

import { useColor } from "~/hooks/use-color";

export function ThreadReaderFooter({
  isPinned,
  mailbox,
  onArchive,
  onDelete,
  onPin,
  onRestore,
}: {
  isPinned: boolean;
  mailbox: "archive" | "inbox";
  onArchive: () => void;
  onDelete: () => void;
  onPin: () => void;
  onRestore: () => void;
}) {
  if (mailbox === "archive") {
    return <ArchiveFooter onDelete={onDelete} onRestore={onRestore} />;
  }
  return (
    <InboxFooter isPinned={isPinned} onArchive={onArchive} onPin={onPin} />
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
}: {
  isPinned: boolean;
  onArchive: () => void;
  onPin: () => void;
}) {
  const foreground = useColor("foreground");
  return (
    <View className="mt-1 flex-row gap-2">
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
      {icon}
      <Text
        className="text-foreground text-sm font-semibold"
        style={color ? { color } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}
