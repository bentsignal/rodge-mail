import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { Animated, RefreshControl, View } from "react-native";
import { Easing, LinearTransition } from "react-native-reanimated";
import { AnimatedLegendList } from "@legendapp/list/reanimated";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { PageStatus } from "../lib/next-page";
import type { MobileMailbox } from "../store";
import type { InboxHeader } from "./inbox-header";
import type { MailboxFilter } from "./mailbox-controls";
import { useColor } from "~/hooks/use-color";
import { useNextPage } from "../hooks/use-next-page";
import { useSteadyData } from "../hooks/use-steady-data";
import { getPageFooter, NEXT_PAGE_THRESHOLD } from "../lib/next-page";
import { stableRows } from "../lib/stable-rows";
import { EmptyInbox, InboxFooter } from "./inbox-list-feedback";
import { getInboxListFeedback } from "./inbox-list-state";
import { ListHeader, MailboxHeaderSlot } from "./mailbox-list-header";
import { useInboxFilterTransition } from "./use-inbox-filter-transition";

/** A row's height plus the gap below it. */
const rowExtent = 109;

// Rows that move (a pin, a new message, a removal closing its gap) slide to
// their new place. Reanimated animates each row container's frame on the UI
// thread; nothing re-renders while it moves.
const rowMove = LinearTransition.duration(260).easing(
  Easing.bezier(0.25, 0.1, 0.25, 1),
);

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
  onFilterChange: (value: MailboxFilter) => void;
  onLoadMore: () => void;
  onRefresh?: () => void;
  onSpamSelect: () => void;
  onToggleSelection: () => void;
  pageStatus: PageStatus;
  primary: string;
  refreshError?: string;
  renderThread: (
    info: LegendListRenderItemProps<MailThread>,
  ) => React.ReactElement;
  searchMode?: boolean;
  searchTerm?: string;
  selectedCount: number;
  selectionMode: boolean;
  selectionEnabled?: boolean;
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
  onFilterChange,
  onLoadMore,
  onRefresh,
  onSpamSelect,
  onToggleSelection,
  pageStatus,
  primary,
  refreshError,
  renderThread,
  searchMode = false,
  searchTerm,
  selectedCount,
  selectionMode,
  selectionEnabled = true,
}: MailboxThreadListProps) {
  const background = useColor("background");
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
    <View className="bg-background flex-1">
      <MailboxHeaderSlot
        accountFilter={accountFilter}
        accounts={accounts}
        bulkActions={bulkActions}
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
        searchMode={searchMode}
        selectedCount={selectedCount}
        selectionEnabled={selectionEnabled}
        selectionMode={selectionMode}
      />
      <MailboxRows
        accounts={accounts}
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
        }}
        mailbox={mailbox}
        listVersion={`${accountFilter}:${filter}:${selectionMode}:${selectedCount}`}
        pageStatus={pageStatus}
        onLoadMore={onLoadMore}
        background={background}
        primary={primary}
        refreshControl={refreshControl}
        refreshError={refreshError}
        renderThread={renderThread}
        searchMode={searchMode}
        searchTerm={searchTerm}
        transition={transition}
      />
    </View>
  );
}

interface MailboxRowsProps {
  accounts: MobileMailAccount[];
  feedback: ReturnType<typeof getInboxListFeedback>;
  headerInList: boolean;
  headerProps: React.ComponentProps<typeof InboxHeader>;
  mailbox: MobileMailbox;
  listVersion: string;
  onLoadMore: () => void;
  pageStatus: PageStatus;
  background: string;
  primary: string;
  refreshControl:
    | React.ReactElement<React.ComponentProps<typeof RefreshControl>>
    | undefined;
  refreshError: string | undefined;
  renderThread: MailboxThreadListProps["renderThread"];
  searchMode: boolean;
  searchTerm: string | undefined;
  transition: ReturnType<
    typeof useInboxFilterTransition<MailThread, MailboxFilter>
  >;
}

function MailboxRows({
  accounts,
  feedback,
  headerInList,
  headerProps,
  mailbox,
  listVersion,
  onLoadMore,
  pageStatus,
  background,
  primary,
  refreshControl,
  refreshError,
  renderThread,
  searchMode,
  searchTerm,
  transition,
}: MailboxRowsProps) {
  const steady = useSteadyData(stableRows(transition.data), threadKey);
  const { listRef, request, resetOnDrag } = useNextPage({
    onLoadMore,
    pageStatus,
    rowExtent,
    rowsPending: steady.rowsPending,
  });
  return (
    <Animated.View style={{ flex: 1, opacity: transition.opacity }}>
      <AnimatedLegendList
        contentContainerStyle={{ paddingBottom: 24 }}
        {...steady.listProps}
        ref={listRef}
        data={steady.data}
        estimatedItemSize={rowExtent}
        extraData={listVersion}
        itemLayoutAnimation={rowMove}
        keyExtractor={threadKey}
        recycleItems={false}
        refreshControl={refreshControl}
        renderItem={renderThread}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        stickyHeaderIndices={headerInList ? [0] : undefined}
        style={{ backgroundColor: background, flex: 1 }}
        onEndReached={request}
        onEndReachedThreshold={NEXT_PAGE_THRESHOLD}
        onScroll={(event) => {
          steady.listProps.onScroll(event);
          request();
        }}
        onScrollBeginDrag={() => {
          steady.listProps.onScrollBeginDrag();
          resetOnDrag();
        }}
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
          <ListHeader
            accounts={accounts}
            headerInList={headerInList}
            headerProps={headerProps}
            refreshError={refreshError}
            searchMode={searchMode}
          />
        }
        ListFooterComponent={
          <InboxFooter
            state={getPageFooter({
              isLoading: feedback.footerIsLoading,
              status: transition.data.length === 0 ? "Exhausted" : pageStatus,
            })}
          />
        }
      />
    </Animated.View>
  );
}

function threadKey(thread: MailThread) {
  return thread.id;
}
