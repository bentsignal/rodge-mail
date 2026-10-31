import type { FunctionReturnType } from "convex/server";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Paperclip, RotateCcw } from "lucide-react-native";

import type { api as Api } from "@rodge-mail/convex/api";
import { api } from "@rodge-mail/convex/api";
import {
  formatSentRecipients,
  getSentStatusLabel,
  getSentSubject,
} from "@rodge-mail/features/mail";

import { useColor } from "~/hooks/use-color";
import { formatInboxMessageTime } from "../lib/mail-format";
import { isOptimisticOutboxId } from "../outgoing/outbox-optimistic";
import { useOutgoingMail } from "../outgoing/outgoing-store";
import { getSentRowTarget } from "./sent-navigation";

export type SentRow = FunctionReturnType<
  typeof Api.outbox.queries.listUnsent
>[number];

const PAGE_SIZE = 30;

/** Mail you've sent, with anything still in the outbox on top. */
export function SentScreen() {
  const router = useRouter();
  const unsent = useQuery(api.outbox.queries.listUnsent, {});
  const sent = usePaginatedQuery(
    api.outbox.queries.listSent,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const retry = useOutgoingMail((store) => store.retryOutboxMessage);
  const sections = [
    { data: unsent ?? [], key: "outbox", title: "Outbox" },
    { data: sent.results, key: "sent", title: "Sent" },
  ].filter((section) => section.data.length > 0);
  const isLoading = unsent === undefined || sent.status === "LoadingFirstPage";

  return (
    <>
      <Stack.Screen options={{ headerLargeTitle: true, title: "Sent" }} />
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        keyExtractor={(row) => row._id}
        ListEmptyComponent={<SentEmpty isLoading={isLoading} />}
        ListFooterComponent={
          sent.status === "LoadingMore" ? (
            <ActivityIndicator className="py-6" />
          ) : null
        }
        renderItem={({ item }) => (
          <SentListRow
            row={item}
            onOpen={() => {
              const target = getSentRowTarget(item);
              if (target) router.push(target);
            }}
            onRetry={() => retry(item._id)}
          />
        )}
        renderSectionHeader={({ section }) =>
          sections.length > 1 ? <SectionHeader title={section.title} /> : null
        }
        sections={sections}
        stickySectionHeadersEnabled={false}
        testID="sent-list"
        onEndReached={() => {
          if (sent.status === "CanLoadMore") sent.loadMore(PAGE_SIZE);
        }}
      />
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-muted-foreground px-4 pt-5 pb-1.5 text-[13px] font-semibold uppercase">
      {title}
    </Text>
  );
}

function SentEmpty({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <ActivityIndicator className="py-16" />;
  return (
    <Text className="text-muted-foreground py-16 text-center text-base">
      No sent mail
    </Text>
  );
}

function SentListRow({
  onOpen,
  onRetry,
  row,
}: {
  onOpen: () => void;
  onRetry: () => void;
  row: SentRow;
}) {
  const recipients = formatSentRecipients(row.to);
  const subject = getSentSubject(row.subject);
  return (
    <Pressable
      accessibilityLabel={`To ${recipients}, ${subject}, ${getSentStatusLabel(row.status)}`}
      accessibilityRole="button"
      className="active:bg-muted pl-4"
      disabled={isOptimisticOutboxId(row._id)}
      testID={`sent-row-${row._id}`}
      onPress={onOpen}
    >
      <View className="border-border gap-0.5 border-b-[0.5px] py-3 pr-4">
        <View className="flex-row items-center gap-2">
          <Text
            className="text-foreground min-w-0 flex-1 text-base font-semibold"
            numberOfLines={1}
          >
            {recipients}
          </Text>
          <AttachmentMarker count={row.attachmentCount} />
          <Text className="text-muted-foreground text-sm">
            {formatInboxMessageTime(
              new Date(row.sentAt ?? row.createdAt).toISOString(),
            )}
          </Text>
        </View>
        <Text className="text-foreground text-[15px]" numberOfLines={1}>
          {subject}
        </Text>
        <Text
          className="text-muted-foreground text-[15px] leading-5"
          numberOfLines={2}
        >
          {row.snippet}
        </Text>
        <SentRowStatus status={row.status} onRetry={onRetry} />
      </View>
    </Pressable>
  );
}

function AttachmentMarker({ count }: { count: number }) {
  const mutedForeground = useColor("muted-foreground");
  if (count === 0) return null;
  return <Paperclip color={mutedForeground} size={13} />;
}

function SentRowStatus({
  onRetry,
  status,
}: {
  onRetry: () => void;
  status: SentRow["status"];
}) {
  if (status === "sent") return null;
  return (
    <View className="mt-1.5 min-h-8 flex-row items-center gap-2">
      <SendingIndicator status={status} />
      <Text
        className={
          status === "failed"
            ? "text-destructive text-[13px] font-semibold"
            : "text-muted-foreground text-[13px] font-semibold"
        }
      >
        {getSentStatusLabel(status)}
      </Text>
      <RetryPill status={status} onRetry={onRetry} />
    </View>
  );
}

function SendingIndicator({ status }: { status: SentRow["status"] }) {
  if (status !== "sending") return null;
  return <ActivityIndicator size="small" />;
}

function RetryPill({
  onRetry,
  status,
}: {
  onRetry: () => void;
  status: SentRow["status"];
}) {
  const foreground = useColor("foreground");
  if (status !== "failed") return null;
  return (
    <Pressable
      accessibilityLabel="Retry sending"
      accessibilityRole="button"
      className="bg-muted ml-auto h-8 flex-row items-center gap-1.5 rounded-full px-3"
      hitSlop={6}
      testID="sent-row-retry"
      onPress={onRetry}
    >
      <RotateCcw color={foreground} size={13} />
      <Text className="text-foreground text-sm font-semibold">Retry</Text>
    </Pressable>
  );
}
