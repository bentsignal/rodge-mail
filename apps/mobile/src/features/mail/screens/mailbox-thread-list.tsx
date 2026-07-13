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
      {!headerInList && (
        <MailboxHeader
          accountFilter={accountFilter}
          accounts={accounts}
          filter={filter}
          includeTopSafeArea={includeTopSafeArea}
          onAccountChange={onAccountChange}
          onFilterChange={onFilterChange}
          onToggleSelection={onToggleSelection}
          refreshError={refreshError}
          selectionMode={selectionMode}
        />
      )}
      <Animated.View style={{ flex: 1, opacity: transition.opacity }}>
        <LegendList
          contentContainerStyle={{
            paddingBottom: 24,
            paddingTop: headerInList ? 0 : 12,
          }}
          data={transition.data}
          estimatedItemSize={109}
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
            headerInList ? (
              <MailboxHeader
                accountFilter={accountFilter}
                accounts={accounts}
                filter={filter}
                includeTopSafeArea={includeTopSafeArea}
                onAccountChange={onAccountChange}
                onFilterChange={onFilterChange}
                onToggleSelection={onToggleSelection}
                refreshError={refreshError}
                selectionMode={selectionMode}
              />
            ) : undefined
          }
          ListFooterComponent={
            <InboxFooter
              isLoading={feedback.footerIsLoading}
              primary={primary}
            />
          }
        />
      </Animated.View>
      <MailboxBulkToolbarSlot
        actions={bulkActions}
        selectedCount={selectedCount}
        selectionMode={selectionMode}
      />
    </View>
  );
}

function MailboxHeader(props: React.ComponentProps<typeof InboxHeader>) {
  return <InboxHeader {...props} />;
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
      <Text className="text-muted-foreground pt-2 text-center text-xs font-medium">
        {getSelectionLabel(selectedCount)}
      </Text>
      <View className="flex-row justify-center gap-1 px-2 pb-1">
        {actions.map((action) => (
          <Host
            key={action.label}
            colorScheme={colorScheme}
            seedColor={action.destructive ? destructive : primary}
            style={{ height: 42, width: 104 }}
          >
            <Button
              disabled={selectedCount === 0}
              label={action.label}
              style={{ height: 42, width: 104 }}
              variant="text"
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
