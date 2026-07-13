import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { Animated, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Host } from "@expo/ui";
import { LegendList } from "@legendapp/list/react-native";

import type { MailAccountFilter, MailThread } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { MailboxFilter } from "./mailbox-controls";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
import { useColor } from "~/hooks/use-color";
import { InboxHeader } from "./inbox-header";
import { EmptyInbox, InboxFooter } from "./inbox-list-feedback";
import { getInboxListFeedback } from "./inbox-list-state";
import { useInboxFilterTransition } from "./use-inbox-filter-transition";

export interface MailboxBulkAction {
  destructive?: boolean;
  label: string;
  onPress: () => void;
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
  mailbox: "archive" | "inbox";
  onAccountChange: (value: MailAccountFilter) => void;
  onArchiveSelect: () => void;
  onEndReached: () => void;
  onFilterChange: (value: MailboxFilter) => void;
  onRefresh?: () => void;
  onToggleSelection: () => void;
  primary: string;
  refreshError?: string;
  renderThread: (
    info: LegendListRenderItemProps<MailThread>,
  ) => React.ReactElement;
  searchTerm?: string;
  selectedCount: number;
  selectionMode: boolean;
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
  onToggleSelection,
  primary,
  refreshError,
  renderThread,
  searchTerm,
  selectedCount,
  selectionMode,
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
        refreshError={refreshError}
        selectionMode={selectionMode}
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
          refreshError,
          selectionMode,
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
  mailbox: "archive" | "inbox";
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

function MailboxBulkToolbar({
  actions,
  selectedCount,
}: {
  actions: MailboxBulkAction[];
  selectedCount: number;
}) {
  const colorScheme = useResolvedMobileColorScheme();
  const destructive = useColor("destructive");
  const primary = useColor("primary");

  return (
    <SafeAreaView
      className="bg-paper border-paper-border border-t"
      edges={["bottom"]}
    >
      <View className="min-h-14 flex-row items-center gap-1 px-3 py-1.5">
        <Text className="text-foreground min-w-16 text-sm font-semibold">
          {getSelectionLabel(selectedCount)}
        </Text>
        {actions.map((action) => (
          <Host
            key={action.label}
            colorScheme={colorScheme}
            seedColor={action.destructive ? destructive : primary}
            style={{ flex: 1, height: 42 }}
          >
            <Button
              disabled={selectedCount === 0}
              label={action.label}
              style={{ height: 42, width: "100%" }}
              variant="outlined"
              onPress={action.onPress}
            />
          </Host>
        ))}
      </View>
    </SafeAreaView>
  );
}

function getSelectionLabel(selectedCount: number) {
  if (selectedCount === 1) return "1 selected";
  return `${selectedCount} selected`;
}

function threadKey(thread: MailThread) {
  return thread.id;
}
