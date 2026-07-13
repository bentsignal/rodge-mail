import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { Animated, RefreshControl, View } from "react-native";
import { LegendList } from "@legendapp/list/react-native";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { MobileMailbox } from "../store";
import type { MailboxFilter } from "./mailbox-controls";
import { useColor } from "~/hooks/use-color";
import { InboxHeader } from "./inbox-header";
import { EmptyInbox, InboxFooter } from "./inbox-list-feedback";
import { getInboxListFeedback } from "./inbox-list-state";
import { MailboxBulkToolbar } from "./mailbox-bulk-toolbar";
import { useInboxFilterTransition } from "./use-inbox-filter-transition";

export interface MailboxBulkAction {
  destructive?: boolean;
  label: string;
  onPress: () => void;
  systemImage:
    | "archivebox"
    | "arrow.uturn.backward"
    | "envelope.badge"
    | "envelope.open"
    | "trash";
}

interface MailboxThreadListProps {
  accountFilter: MailAccountFilter;
  accounts: MobileMailAccount[];
  bulkActions: MailboxBulkAction[];
  data: MailThread[];
  emptyIsLoading: boolean;
  filter: MailboxFilter;
  footerIsLoading: boolean;
  headerInList?: boolean;
  includeTopSafeArea?: boolean;
  isRefreshing?: boolean;
  mailbox: MobileMailbox;
  onAccountChange: (value: MailAccountFilter) => void;
  onArchiveSelect: () => void;
  onEndReached: () => void;
  onFilterChange: (value: MailboxFilter) => void;
  onRefresh?: () => void;
  onSpamSelect: () => void;
  onToggleSelection: () => void;
  primary: string;
  refreshError?: string;
  renderThread: (
    info: LegendListRenderItemProps<MailThread>,
  ) => React.ReactElement;
  searchTerm?: string;
  selectedCount: number;
  selectionMode: boolean;
  selectionEnabled?: boolean;
  temporarySearch?: {
    onChange: (value: string) => void;
    value: string;
  };
}

export function MailboxThreadList({
  accountFilter,
  accounts,
  bulkActions,
  data,
  emptyIsLoading,
  filter,
  footerIsLoading,
  headerInList = false,
  includeTopSafeArea = true,
  isRefreshing,
  mailbox,
  onAccountChange,
  onArchiveSelect,
  onEndReached,
  onFilterChange,
  onRefresh,
  onSpamSelect,
  onToggleSelection,
  primary,
  refreshError,
  renderThread,
  searchTerm,
  selectedCount,
  selectionMode,
  selectionEnabled = true,
  temporarySearch,
}: MailboxThreadListProps) {
  const paper = useColor("paper");
  const transition = useInboxFilterTransition(data, filter);
  const feedback = getInboxListFeedback({
    emptyIsLoading,
    footerIsLoading,
    resultCount: transition.data.length,
  });
  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={isRefreshing ?? false}
      tintColor={primary}
      onRefresh={onRefresh}
    />
  ) : undefined;

  return (
    <View className="bg-paper flex-1">
      <MailboxHeaderSlot
        accountFilter={accountFilter}
        accounts={accounts}
        filter={filter}
        headerInList={headerInList}
        includeTopSafeArea={includeTopSafeArea}
        mailbox={mailbox}
        onAccountChange={onAccountChange}
        onArchiveSelect={onArchiveSelect}
        onFilterChange={onFilterChange}
        onToggleSelection={onToggleSelection}
        onSpamSelect={onSpamSelect}
        refreshError={refreshError}
        selectionEnabled={selectionEnabled}
        selectionMode={selectionMode}
        temporarySearch={temporarySearch}
      />
      <MailboxRows
        feedback={feedback}
        headerInList={headerInList}
        headerProps={{
          accountFilter,
          accounts,
          filter,
          includeTopSafeArea,
          mailbox,
          onAccountChange,
          onArchiveSelect,
          onFilterChange,
          onToggleSelection,
          onSpamSelect,
          refreshError,
          selectionMode,
          selectionEnabled,
          temporarySearch,
        }}
        mailbox={mailbox}
        listVersion={`${accountFilter}:${filter}:${selectionMode}:${selectedCount}`}
        onEndReached={onEndReached}
        paper={paper}
        primary={primary}
        refreshControl={refreshControl}
        renderThread={renderThread}
        searchTerm={searchTerm}
        transition={transition}
      />
      <MailboxBulkToolbarSlot
        actions={bulkActions}
        selectedCount={selectedCount}
        selectionMode={selectionMode}
      />
    </View>
  );
}

function MailboxRows({
  feedback,
  headerInList,
  headerProps,
  mailbox,
  listVersion,
  onEndReached,
  paper,
  primary,
  refreshControl,
  renderThread,
  searchTerm,
  transition,
}: {
  feedback: ReturnType<typeof getInboxListFeedback>;
  headerInList: boolean;
  headerProps: React.ComponentProps<typeof InboxHeader>;
  mailbox: MobileMailbox;
  listVersion: string;
  onEndReached: () => void;
  paper: string;
  primary: string;
  refreshControl:
    | React.ReactElement<React.ComponentProps<typeof RefreshControl>>
    | undefined;
  renderThread: MailboxThreadListProps["renderThread"];
  searchTerm: string | undefined;
  transition: ReturnType<
    typeof useInboxFilterTransition<MailThread, MailboxFilter>
  >;
}) {
  return (
    <Animated.View style={{ flex: 1, opacity: transition.opacity }}>
      <LegendList
        contentContainerStyle={{
          paddingBottom: 24,
          paddingTop: headerInList ? 0 : 12,
        }}
        data={transition.data}
        estimatedItemSize={109}
        extraData={listVersion}
        keyExtractor={threadKey}
        maintainVisibleContentPosition={true}
        recycleItems={true}
        refreshControl={refreshControl}
        renderItem={renderThread}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        stickyHeaderIndices={headerInList ? [0] : undefined}
        style={{ backgroundColor: paper, flex: 1 }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          <EmptyInbox
            filter={transition.filter}
            isLoading={feedback.emptyIsLoading}
            mailbox={mailbox}
            primary={primary}
            searchTerm={searchTerm}
          />
        }
        ListHeaderComponent={
          headerInList ? <MailboxHeader {...headerProps} /> : undefined
        }
        ListFooterComponent={
          <InboxFooter isLoading={feedback.footerIsLoading} primary={primary} />
        }
      />
    </Animated.View>
  );
}

function MailboxHeader(props: React.ComponentProps<typeof InboxHeader>) {
  return <InboxHeader {...props} />;
}

function MailboxHeaderSlot({
  headerInList,
  ...props
}: React.ComponentProps<typeof InboxHeader> & { headerInList: boolean }) {
  if (headerInList) return null;
  return <MailboxHeader {...props} />;
}

function MailboxBulkToolbarSlot({
  actions,
  selectedCount,
  selectionMode,
}: {
  actions: MailboxBulkAction[];
  selectedCount: number;
  selectionMode: boolean;
}) {
  if (!selectionMode) return null;
  return <MailboxBulkToolbar actions={actions} selectedCount={selectedCount} />;
}

function threadKey(thread: MailThread) {
  return thread.id;
}
