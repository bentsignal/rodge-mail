import {
  ActivityIndicator,
  Pressable,
  SectionList,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Paperclip, RotateCcw } from "lucide-react-native";

import { api } from "@rodge-mail/convex/api";
import {
  formatSentRecipients,
  getSentStatusLabel,
  getSentSubject,
} from "@rodge-mail/features/mail";

import type { SentRow } from "./sent-row";
import { ContentReveal } from "~/components/content-reveal";
import { useColor } from "~/hooks/use-color";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { useCachedMailboxPage } from "../hooks/use-cached-mailbox-page";
import { toConvexId } from "../lib/convex-id";
import { formatInboxMessageTime } from "../lib/mail-format";
import { isOptimisticOutboxId } from "../outgoing/outbox-optimistic";
import { useOutgoingMail } from "../outgoing/outgoing-store";
import { MAIL_SEARCH_DEBOUNCE_MS } from "../screens/inbox-list-state";
import {
  MailboxHeaderSlot,
  SelectedAccountLabel,
} from "../screens/mailbox-list-header";
import { useMailStore } from "../store";
import { getSentRowTarget } from "./sent-navigation";
import { filterSentRows } from "./sent-row";

const PAGE_SIZE = 30;

/** Mail you've sent, with anything still in the outbox on top. */
export function SentMailbox({
  searchMode,
  searchTerm,
}: {
  searchMode: boolean;
  searchTerm: string;
}) {
  const router = useRouter();
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const retry = useOutgoingMail((store) => store.retryOutboxMessage);
  const { activeSearchTerm, isLoading, sections, sent } =
    useSentSections(searchTerm);

  return (
    <>
      <MailboxHeaderSlot
        accountFilter={accountFilter}
        accounts={accounts}
        bulkActions={[]}
        filter="all"
        filterEnabled={false}
        headerInList={false}
        mailbox="sent"
        onFilterChange={() => undefined}
        onToggleSelection={() => undefined}
        refreshError={undefined}
        searchMode={searchMode}
        selectedCount={0}
        selectionEnabled={false}
        selectionMode={false}
      />
      <ContentReveal isReady={!isLoading}>
        <SectionList
          key={accountFilter}
          contentInsetAdjustmentBehavior="automatic"
          keyExtractor={(row) => row._id}
          ListEmptyComponent={<SentEmpty searchTerm={activeSearchTerm} />}
          ListFooterComponent={
            sent.status === "LoadingMore" ? (
              <ActivityIndicator className="py-6" />
            ) : null
          }
          ListHeaderComponent={<SentListHeader searchMode={searchMode} />}
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
      </ContentReveal>
    </>
  );
}

function useSentSections(searchTerm: string) {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const accountId =
    accountFilter === "all"
      ? undefined
      : toConvexId<"mailAccounts">(accountFilter);
  const unsent = useQuery(api.outbox.queries.listUnsent, {});
  const sent = usePaginatedQuery(
    api.outbox.queries.listSent,
    { accountId },
    { initialNumItems: PAGE_SIZE },
  );
  const sentRows = useCachedMailboxPage({
    accountId,
    isPending: sent.status === "LoadingFirstPage",
    mailbox: "sent",
    rows: sent.results,
    selectCache: (store) => store.sentPages,
  });
  const normalizedSearchTerm = searchTerm.trim();
  const delayedSearchTerm = useDebouncedValue(
    normalizedSearchTerm,
    MAIL_SEARCH_DEBOUNCE_MS,
  );
  const activeSearchTerm = normalizedSearchTerm ? delayedSearchTerm : "";
  const unsentRows = (unsent ?? []).filter(
    (row) => !accountId || row.accountId === accountId,
  );
  const sections = [
    {
      data: filterSentRows(unsentRows, activeSearchTerm),
      key: "outbox",
      title: "Outbox",
    },
    {
      data: filterSentRows(sentRows, activeSearchTerm),
      key: "sent",
      title: "Sent",
    },
  ].filter((section) => section.data.length > 0);
  return {
    activeSearchTerm,
    isLoading:
      sections.length === 0 &&
      (unsent === undefined || sent.status === "LoadingFirstPage"),
    sections,
    sent,
  };
}

function SentListHeader({ searchMode }: { searchMode: boolean }) {
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  if (searchMode) return null;
  return (
    <SelectedAccountLabel accountFilter={accountFilter} accounts={accounts} />
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-muted-foreground px-4 pt-5 pb-1.5 text-[13px] font-semibold uppercase">
      {title}
    </Text>
  );
}

function SentEmpty({ searchTerm }: { searchTerm: string }) {
  const label = searchTerm ? "No matching mail" : "No sent mail";
  return (
    <Text className="text-muted-foreground py-16 text-center text-base">
      {label}
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
  if (status !== "pending" && status !== "sending") return null;
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
