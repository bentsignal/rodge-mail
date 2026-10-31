import type { LegendListRenderItemProps } from "@legendapp/list/react";
import { useLayoutEffect, useRef, useState } from "react";
import { LegendList } from "@legendapp/list/react";
import { Inbox, LoaderCircle, Sparkles } from "lucide-react";

import type { MailMode } from "../live-data-types";
import type { InboxMessage } from "../types";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { ThreadRow } from "./thread-row";

export function ThreadList() {
  const searchQuery = useMailStore((store) => store.searchQuery);
  const unreadOnly = useMailStore((store) => store.unreadOnly);
  const {
    canLoadMore,
    canSeedDemo,
    inboxMessages,
    isLoadingInbox,
    isLoadingMore,
    isSearchingInbox,
    isSeedingDemo,
    loadMore,
    mailMode,
    seedDemoMail,
  } = useLiveMail();

  if (isLoadingInbox) return <ThreadListSkeleton />;

  if (isSearchingInbox && inboxMessages.length === 0) {
    return <SearchPendingState />;
  }

  if (inboxMessages.length === 0) {
    return (
      <EmptyThreadList
        canSeedDemo={canSeedDemo}
        isSearch={searchQuery.trim().length > 0}
        isSeedingDemo={isSeedingDemo}
        mailMode={mailMode}
        seedDemoMail={seedDemoMail}
        unreadOnly={unreadOnly}
      />
    );
  }

  return (
    <VirtualizedThreadList
      canLoadMore={canLoadMore}
      isLoadingMore={isLoadingMore}
      isSearching={isSearchingInbox}
      loadMore={loadMore}
      messages={inboxMessages}
    />
  );
}

function VirtualizedThreadList({
  canLoadMore,
  isLoadingMore,
  isSearching,
  loadMore,
  messages,
}: {
  canLoadMore: boolean;
  isLoadingMore: boolean;
  isSearching: boolean;
  loadMore: () => void;
  messages: InboxMessage[];
}) {
  const { containerHeight, containerRef } = useListContainerHeight();

  function loadOlderMessages() {
    if (!canLoadMore || isLoadingMore || isSearching) return;
    loadMore();
  }

  return (
    <div className="min-h-0 flex-1" ref={containerRef}>
      <MeasuredThreadList
        canLoadMore={canLoadMore}
        containerHeight={containerHeight}
        isLoadingMore={isLoadingMore}
        isSearching={isSearching}
        loadOlderMessages={loadOlderMessages}
        messages={messages}
      />
    </div>
  );
}

function MeasuredThreadList({
  canLoadMore,
  containerHeight,
  isLoadingMore,
  isSearching,
  loadOlderMessages,
  messages,
}: {
  canLoadMore: boolean;
  containerHeight: number;
  isLoadingMore: boolean;
  isSearching: boolean;
  loadOlderMessages: () => void;
  messages: InboxMessage[];
}) {
  if (containerHeight <= 0) return null;
  return (
    <LegendList
      aria-busy={isLoadingMore || isSearching}
      aria-label="Messages"
      className="mail-scrollbar"
      data={messages}
      keyExtractor={getMessageKey}
      maintainVisibleContentPosition={true}
      onEndReached={loadOlderMessages}
      onEndReachedThreshold={1.5}
      recycleItems={true}
      renderItem={renderThreadRow}
      role="feed"
      style={{ height: containerHeight }}
      ListFooterComponent={
        <ThreadListFooter
          canLoadMore={canLoadMore}
          isLoadingMore={isLoadingMore}
          isSearching={isSearching}
        />
      }
    />
  );
}

function SearchPendingState() {
  return (
    <div
      className="mail-label flex min-h-0 flex-1 items-center justify-center gap-2"
      role="status"
    >
      <LoaderCircle className="size-3.5 animate-spin" />
      <span className="text-[11px] font-medium tracking-wide uppercase">
        Searching
      </span>
    </div>
  );
}

function renderThreadRow({
  index,
  item,
}: LegendListRenderItemProps<InboxMessage>) {
  return <ThreadRow message={item} position={index + 1} />;
}

function getMessageKey(message: InboxMessage) {
  return message.threadId;
}

function useListContainerHeight() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    setContainerHeight(element.clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { containerHeight, containerRef };
}

function EmptyThreadList({
  canSeedDemo,
  isSearch,
  isSeedingDemo,
  mailMode,
  seedDemoMail,
  unreadOnly,
}: {
  canSeedDemo: boolean;
  isSearch: boolean;
  isSeedingDemo: boolean;
  mailMode: MailMode;
  seedDemoMail: () => Promise<void>;
  unreadOnly: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
      <span className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-[12px] border">
        <Inbox className="size-5" strokeWidth={1.5} />
      </span>
      <p className="text-lg font-semibold">No messages</p>
      <p className="mail-label mt-1 max-w-xs text-sm leading-6">
        {getEmptyDescription(isSearch, canSeedDemo, unreadOnly, mailMode)}
      </p>
      <DevelopmentSeedButton
        canSeedDemo={canSeedDemo}
        isSeedingDemo={isSeedingDemo}
        seedDemoMail={seedDemoMail}
      />
    </div>
  );
}

function DevelopmentSeedButton({
  canSeedDemo,
  isSeedingDemo,
  seedDemoMail,
}: {
  canSeedDemo: boolean;
  isSeedingDemo: boolean;
  seedDemoMail: () => Promise<void>;
}) {
  if (!canSeedDemo) return null;
  return (
    <button
      className="mail-primary-button mt-5 flex h-9 items-center gap-2 rounded-[9px] px-4 text-xs font-bold transition disabled:cursor-wait disabled:opacity-60"
      disabled={isSeedingDemo}
      onClick={() => void seedDemoMail()}
      type="button"
    >
      <SeedButtonIcon isSeeding={isSeedingDemo} />
      <SeedButtonLabel isSeeding={isSeedingDemo} />
    </button>
  );
}

function SeedButtonIcon({ isSeeding }: { isSeeding: boolean }) {
  if (isSeeding) return <LoaderCircle className="size-3.5 animate-spin" />;
  return <Sparkles className="size-3.5" />;
}

function SeedButtonLabel({ isSeeding }: { isSeeding: boolean }) {
  if (isSeeding) return "Preparing mail…";
  return "Load development mail";
}

function getEmptyDescription(
  isSearch: boolean,
  canSeedDemo: boolean,
  unreadOnly: boolean,
  mailMode: MailMode,
) {
  if (isSearch) return "Try a sender, subject, or phrase from the message.";
  if (mailMode === "archive") return "Conversations you archive appear here.";
  if (mailMode === "spam")
    return "High-confidence junk is kept here for review.";
  if (unreadOnly) return "Everything in this mailbox has been read.";
  if (canSeedDemo) {
    return "This development mailbox is empty. Add the safe demo set to exercise the live Convex path.";
  }
  return "New mail will appear here.";
}

function ThreadListSkeleton() {
  return (
    <div aria-label="Loading inbox" className="min-h-0 flex-1 overflow-hidden">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div
          className="border-border flex animate-pulse gap-2 border-b px-5 py-4"
          key={index}
        >
          <div className="bg-muted size-8 shrink-0 rounded-[10px]" />
          <div className="flex-1 space-y-2.5">
            <div className="bg-muted h-2.5 w-2/5 rounded-full" />
            <div className="bg-muted h-3.5 w-4/5 rounded-full" />
            <div className="bg-background h-2.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreadListEnd() {
  return (
    <div className="mail-label flex items-center gap-3 px-6 py-7">
      <span className="bg-border h-px flex-1" />
      <span className="text-[10px] font-medium tracking-wide uppercase">
        End of view
      </span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}

function ThreadListFooter({
  canLoadMore,
  isLoadingMore,
  isSearching,
}: {
  canLoadMore: boolean;
  isLoadingMore: boolean;
  isSearching: boolean;
}) {
  if (isSearching) return <div aria-hidden="true" className="h-6" />;
  if (!canLoadMore && !isLoadingMore) return <ThreadListEnd />;
  if (!isLoadingMore) return <div aria-hidden="true" className="h-6" />;
  return (
    <div
      aria-live="polite"
      className="mail-label flex h-16 items-center justify-center gap-2 text-[11px] font-medium tracking-wide uppercase"
      role="status"
    >
      <LoaderCircle className="size-3 animate-spin" />
      Loading older mail
    </div>
  );
}
