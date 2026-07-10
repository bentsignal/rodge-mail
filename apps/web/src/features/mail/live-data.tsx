import {
  createContext,
  use,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
// eslint-disable-next-line no-restricted-imports -- Mail has intentional loading states and a selection-dependent thread query.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useMutation, usePaginatedQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import { toast } from "@rodge-mail/ui-web/toast";

import type { MailAccountFilter } from "./store";
import type {
  InboxMessage,
  MailAccountDocument,
  MailAccountView,
  MailThreadDetail,
} from "./types";
import { env } from "~/env";
import {
  getErrorMessage,
  getLoadedUnreadCounts,
  sortInboxMessages,
  toAccountView,
} from "./live-data-utils";
import { useMailStore } from "./store";

const PAGE_SIZE = 30;

interface LiveMailContextValue {
  accounts: MailAccountView[];
  canLoadMore: boolean;
  canSeedDemo: boolean;
  inboxMessages: InboxMessage[];
  isLoadingAccounts: boolean;
  isLoadingInbox: boolean;
  isLoadingMore: boolean;
  isLoadingThread: boolean;
  isSeedingDemo: boolean;
  loadMore: () => void;
  replyToSelectedThread: () => void;
  seedDemoMail: () => Promise<void>;
  selectMessage: (message: InboxMessage) => void;
  selectedMessageId: InboxMessage["_id"] | undefined;
  selectedThread: MailThreadDetail | undefined;
  togglePinned: (message: InboxMessage) => Promise<void>;
  toggleRead: (message: InboxMessage) => Promise<void>;
  unreadCounts: Record<string, number>;
}

const LiveMailContext = createContext<LiveMailContextValue | undefined>(
  undefined,
);

export function LiveMailProvider({ children }: { children: React.ReactNode }) {
  const value = useLiveMailValue();
  return (
    <LiveMailContext.Provider value={value}>
      {children}
    </LiveMailContext.Provider>
  );
}

export function useLiveMail() {
  const context = use(LiveMailContext);
  if (!context) {
    throw new Error("useLiveMail must be used within LiveMailProvider");
  }
  return context;
}

function useLiveMailValue() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const searchQuery = useMailStore((store) => store.searchQuery);
  const selectedMessageId = useMailStore((store) => store.selectedMessageId);
  const selectedThreadId = useMailStore((store) => store.selectedThreadId);
  const setInitialSelection = useMailStore(
    (store) => store.setInitialSelection,
  );
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const queryState = useLiveMailQueries({
    accountFilter,
    deferredSearchQuery,
    searchQuery,
    selectedMessageId,
    selectedThreadId,
  });
  const firstMessage = queryState.inboxMessages[0];
  // eslint-disable-next-line no-restricted-syntax -- The live query's first result initializes stable local selection once per view.
  useEffect(() => {
    if (!firstMessage) return;
    setInitialSelection({
      messageId: firstMessage._id,
      threadId: firstMessage.threadId,
    });
  }, [firstMessage, setInitialSelection]);
  const actions = useLiveMailActions(queryState.selectedThread);

  return {
    ...actions,
    ...queryState,
    unreadCounts: getLoadedUnreadCounts(queryState.inboxMessages),
  } satisfies LiveMailContextValue;
}

function useLiveMailQueries({
  accountFilter,
  deferredSearchQuery,
  searchQuery,
  selectedMessageId,
  selectedThreadId,
}: {
  accountFilter: MailAccountFilter;
  deferredSearchQuery: string;
  searchQuery: string;
  selectedMessageId: InboxMessage["_id"] | undefined;
  selectedThreadId: InboxMessage["threadId"] | undefined;
}) {
  const accountId = accountFilter === "all" ? undefined : accountFilter;
  const accountQuery = useAccountsQuery();
  const activePage = useMailboxPage({
    accountId,
    searchTerm: deferredSearchQuery,
  });
  const inboxMessages = sortInboxMessages(activePage.results);
  const effectiveThreadId = selectedThreadId ?? inboxMessages[0]?.threadId;
  const threadQuery = useThreadQuery(effectiveThreadId);
  throwQueryError(accountQuery.error);
  throwQueryError(threadQuery.error);

  return {
    accounts: (accountQuery.data ?? []).map(toAccountView),
    canLoadMore: activePage.status === "CanLoadMore",
    canSeedDemo: canSeedDemoMail(accountQuery.data),
    inboxMessages,
    isLoadingAccounts: accountQuery.isPending,
    isLoadingInbox: getIsLoadingInbox({
      deferredSearchQuery,
      pageStatus: activePage.status,
      searchQuery,
    }),
    isLoadingMore: activePage.status === "LoadingMore",
    isLoadingThread: effectiveThreadId !== undefined && threadQuery.isPending,
    loadMore: () => activePage.loadMore(PAGE_SIZE),
    selectedMessageId: selectedMessageId ?? inboxMessages[0]?._id,
    selectedThread: threadQuery.data,
  };
}

function canSeedDemoMail(accounts: MailAccountDocument[] | undefined) {
  return env.VITE_NODE_ENV === "development" && accounts?.length === 0;
}

function getIsLoadingInbox({
  deferredSearchQuery,
  pageStatus,
  searchQuery,
}: {
  deferredSearchQuery: string;
  pageStatus: string;
  searchQuery: string;
}) {
  return (
    searchQuery.trim() !== deferredSearchQuery ||
    pageStatus === "LoadingFirstPage"
  );
}

function useAccountsQuery() {
  return useQuery({
    ...convexQuery(api.accounts.queries.list, {}),
    select: (accounts) => accounts,
  });
}

function useMailboxPage({
  accountId,
  searchTerm,
}: {
  accountId: InboxMessage["accountId"] | undefined;
  searchTerm: string;
}) {
  const isSearching = searchTerm.length > 0;
  const inbox = usePaginatedQuery(
    api.mail.queries.listInbox,
    isSearching ? "skip" : { accountId },
    { initialNumItems: PAGE_SIZE },
  );
  const search = usePaginatedQuery(
    api.mail.queries.searchHeaders,
    isSearching ? { accountId, searchTerm } : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  return isSearching ? search : inbox;
}

function useThreadQuery(threadId: InboxMessage["threadId"] | undefined) {
  return useQuery({
    ...convexQuery(
      api.mail.queries.getThread,
      threadId ? { threadId } : "skip",
    ),
    select: (thread) => thread,
  });
}

function useLiveMailActions(selectedThread: MailThreadDetail | undefined) {
  const openReply = useMailStore((store) => store.openReply);
  const selectThread = useMailStore((store) => store.selectThread);
  const setPinned = useMutation(api.mail.mutations.setPinned);
  const setRead = useMutation(api.mail.mutations.setRead);
  const seedDemo = useMutation(api.devSeed.seedDemoMail);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);

  async function togglePinned(message: InboxMessage) {
    try {
      await setPinned({ messageId: message._id, isPinned: !message.isPinned });
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update the pin."));
    }
  }

  async function toggleRead(message: InboxMessage) {
    try {
      await setRead({ messageId: message._id, isRead: !message.isRead });
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update read status."));
    }
  }

  function selectMessage(message: InboxMessage) {
    selectThread({ messageId: message._id, threadId: message.threadId });
    if (message.isRead) return;
    void setRead({ messageId: message._id, isRead: true }).catch((error) => {
      toast.error(getErrorMessage(error, "Could not mark the message read."));
    });
  }

  function replyToSelectedThread() {
    const latestMessage = selectedThread?.messages.at(-1);
    if (!selectedThread || !latestMessage) return;
    openReply({
      accountId: selectedThread.accountId,
      address: latestMessage.from.address,
      internetMessageId: latestMessage.internetMessageId,
      subject: selectedThread.subject,
    });
  }

  async function seedDemoMail() {
    if (env.VITE_NODE_ENV !== "development") return;
    setIsSeedingDemo(true);
    try {
      const result = await seedDemo();
      toast.success(
        result.insertedMessages > 0
          ? `Added ${result.insertedMessages} development messages.`
          : "Development mail is already seeded.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not seed development mail."));
    }
    setIsSeedingDemo(false);
  }

  return {
    isSeedingDemo,
    replyToSelectedThread,
    seedDemoMail,
    selectMessage,
    togglePinned,
    toggleRead,
  };
}

function throwQueryError(error: Error | null) {
  if (error) throw error;
}
