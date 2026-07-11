import type { LegendListRenderItemProps } from "@legendapp/list/react";
import { useLayoutEffect, useRef, useState } from "react";
import { LegendList } from "@legendapp/list/react";
import { Inbox, LoaderCircle, Sparkles } from "lucide-react";

import type { InboxMessage } from "../types";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { ThreadRow } from "./thread-row";

export function ThreadList() {
  const searchQuery = useMailStore((store) => store.searchQuery);
  const {
    canLoadMore,
    canSeedDemo,
    inboxMessages,
    isLoadingInbox,
    isLoadingMore,
    isSearchingInbox,
    isSeedingDemo,
    loadMore,
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
        seedDemoMail={seedDemoMail}
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
      <LegendList
        aria-busy={isLoadingMore || isSearching}
        aria-label="Messages"
        className="mail-scrollbar"
        data={messages}
        keyExtractor={getMessageKey}
        maintainVisibleContentPosition={true}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.75}
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
    </div>
  );
}

function SearchPendingState() {
  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center gap-2 text-[#8e8377]"
      role="status"
    >
      <LoaderCircle className="size-3.5 animate-spin" />
      <span className="font-mono text-[9px] tracking-[0.12em] uppercase">
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
  return message._id;
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
  seedDemoMail,
}: {
  canSeedDemo: boolean;
  isSearch: boolean;
  isSeedingDemo: boolean;
  seedDemoMail: () => Promise<void>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full border border-dashed border-[#bfb4a5] text-[#978a7d]">
        <Inbox className="size-5" strokeWidth={1.5} />
      </span>
      <p className="font-serif text-lg font-semibold">Nothing on the desk</p>
      <p className="mt-1 max-w-xs text-sm leading-6 text-[#887d70]">
        {getEmptyDescription(isSearch, canSeedDemo)}
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
      className="mt-5 flex h-9 items-center gap-2 rounded-full bg-[#20251f] px-4 text-xs font-semibold text-[#f8f1e6] transition hover:-translate-y-0.5 hover:bg-[#30362f] disabled:cursor-wait disabled:opacity-60"
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

function getEmptyDescription(isSearch: boolean, canSeedDemo: boolean) {
  if (isSearch) return "Try a sender, subject, or phrase from the message.";
  if (canSeedDemo) {
    return "This development mailbox is empty. Add the safe demo set to exercise the live Convex path.";
  }
  return "This view is clear. New mail will settle here when it arrives.";
}

function ThreadListSkeleton() {
  return (
    <div aria-label="Loading inbox" className="min-h-0 flex-1 overflow-hidden">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div
          className="flex animate-pulse gap-3 border-b border-[#e2dacd] px-5 py-4 dark:border-[#373b35]"
          key={index}
        >
          <div className="size-9 shrink-0 rounded-full bg-[#e7ded0] dark:bg-[#3c413a]" />
          <div className="flex-1 space-y-2.5">
            <div className="h-2.5 w-2/5 rounded-full bg-[#ddd4c6] dark:bg-[#3c413a]" />
            <div className="h-3.5 w-4/5 rounded-full bg-[#e4dbce] dark:bg-[#383d37]" />
            <div className="h-2.5 w-full rounded-full bg-[#ebe4d8] dark:bg-[#343832]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreadListEnd() {
  return (
    <div className="flex items-center gap-3 px-6 py-7 text-[#9b9185]">
      <span className="h-px flex-1 bg-[#dfd7cb] dark:bg-[#3d413b]" />
      <span className="font-mono text-[8px] tracking-[0.18em] uppercase">
        End of view
      </span>
      <span className="h-px flex-1 bg-[#dfd7cb] dark:bg-[#3d413b]" />
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
      className="flex h-16 items-center justify-center gap-2 font-mono text-[9px] tracking-[0.1em] text-[#776e64] uppercase dark:text-[#aaa095]"
      role="status"
    >
      <LoaderCircle className="size-3 animate-spin" />
      Loading older mail
    </div>
  );
}
