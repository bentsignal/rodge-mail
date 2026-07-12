import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useMutation, usePaginatedQuery } from "convex/react";
import { ArchiveRestore, Trash2 } from "lucide-react-native";

import { api } from "@rodge-mail/convex/api";

import { useColor } from "~/hooks/use-color";

const PAGE_SIZE = 30;

export function ArchiveScreen() {
  const archive = usePaginatedQuery(
    api.mail.archiveQueries.listArchive,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <ScrollView
      className="bg-background"
      contentContainerClassName="px-4 pb-24 pt-2"
      contentInsetAdjustmentBehavior="automatic"
    >
      <ArchiveContent archive={archive} />
    </ScrollView>
  );
}

function ArchiveContent({ archive }: { archive: ArchiveQuery }) {
  if (archive.status === "LoadingFirstPage") {
    return <ArchiveLoading />;
  }
  if (archive.results.length === 0) {
    return (
      <View className="items-center gap-2 px-8 py-20">
        <Text className="text-foreground text-lg font-semibold">
          Archive is empty
        </Text>
        <Text className="text-muted-foreground text-center text-sm leading-5">
          Conversations you archive stay here for 30 days.
        </Text>
      </View>
    );
  }
  return (
    <>
      {archive.results.map((thread) => (
        <ArchivedThreadCard key={thread.threadId} thread={thread} />
      ))}
      <ArchiveLoadMore archive={archive} />
    </>
  );
}

function ArchiveLoadMore({ archive }: { archive: ArchiveQuery }) {
  if (archive.status !== "CanLoadMore") return null;
  return (
    <Pressable
      accessibilityRole="button"
      className="border-border items-center rounded-xl border px-4 py-3"
      onPress={() => archive.loadMore(PAGE_SIZE)}
    >
      <Text className="text-foreground font-semibold">Load more</Text>
    </Pressable>
  );
}

function ArchivedThreadCard({ thread }: { thread: ArchivedThread }) {
  const restore = useMutation(api.mail.archiveMutations.restoreArchivedThread);
  const permanentlyDelete = useMutation(
    api.mail.archiveMutations.permanentlyDeleteArchivedThread,
  );
  const [pendingAction, setPendingAction] = useState<"delete" | "restore">();
  const destructive = useColor("destructive");
  const primary = useColor("primary");

  async function restoreThread() {
    setPendingAction("restore");
    try {
      await restore({ threadId: thread.threadId });
    } catch {
      Alert.alert("Couldn’t restore this conversation", "Please try again.");
    }
    setPendingAction(undefined);
  }

  function confirmPermanentDelete() {
    Alert.alert(
      "Permanently delete this conversation?",
      "This removes Rodge Mail’s archived copy and cannot be undone. Your provider copy is unchanged.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => void permanentlyDeleteThread(),
          style: "destructive",
          text: "Delete permanently",
        },
      ],
    );
  }

  async function permanentlyDeleteThread() {
    setPendingAction("delete");
    try {
      await permanentlyDelete({ threadId: thread.threadId });
    } catch {
      Alert.alert("Couldn’t delete this conversation", "Please try again.");
    }
    setPendingAction(undefined);
  }

  return (
    <View className="border-border gap-3 border-b py-4">
      <View className="gap-1">
        <Text className="text-foreground font-semibold" numberOfLines={1}>
          {thread.from.name ?? thread.from.address}
        </Text>
        <Text className="text-foreground text-base" numberOfLines={1}>
          {thread.subject || "(no subject)"}
        </Text>
        <Text className="text-muted-foreground text-sm" numberOfLines={2}>
          {thread.snippet}
        </Text>
      </View>
      <View className="flex-row gap-2">
        <ArchiveAction
          color={primary}
          disabled={pendingAction !== undefined}
          icon={<ArchiveRestore color={primary} size={17} />}
          label="Restore"
          loading={pendingAction === "restore"}
          onPress={() => void restoreThread()}
        />
        <ArchiveAction
          color={destructive}
          disabled={pendingAction !== undefined}
          icon={<Trash2 color={destructive} size={17} />}
          label="Delete"
          loading={pendingAction === "delete"}
          onPress={confirmPermanentDelete}
        />
      </View>
    </View>
  );
}

function ArchiveAction({
  color,
  disabled,
  icon,
  label,
  loading,
  onPress,
}: {
  color: string;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="border-border min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border disabled:opacity-50"
      disabled={disabled}
      onPress={onPress}
    >
      <ArchiveActionIcon color={color} icon={icon} loading={loading} />
      <Text className="font-semibold" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ArchiveActionIcon({
  color,
  icon,
  loading,
}: {
  color: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  if (loading) return <ActivityIndicator color={color} />;
  return icon;
}

function ArchiveLoading() {
  const primary = useColor("primary");
  return (
    <View className="items-center py-20">
      <ActivityIndicator color={primary} />
    </View>
  );
}

type ArchivedThread = FunctionReturnType<
  typeof api.mail.archiveQueries.listArchive
>["page"][number];
interface ArchiveQuery {
  loadMore: (numItems: number) => void;
  results: ArchivedThread[];
  status: "CanLoadMore" | "Exhausted" | "LoadingFirstPage" | "LoadingMore";
}
