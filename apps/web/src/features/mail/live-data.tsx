import { createContext, use, useEffect, useState } from "react";
// eslint-disable-next-line no-restricted-imports -- Mail has intentional loading states and a selection-dependent thread query.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import { getReplyAddress } from "@rodge-mail/features/mail";
import { toast } from "@rodge-mail/ui-web/toast";

import type { MailAccountFilter } from "./store";
import type {
  InboxMessage,
  MailAccountDocument,
  MailAccountView,
  MailThreadDetail,
} from "./types";
import { env } from "~/env";
import { MAIL_PAGE_SIZE } from "./constants";
import {
  getErrorMessage,
  getLoadedUnreadCounts,
  sortInboxMessages,
  toAccountView,
} from "./live-data-utils";
import {
  getIsLoadingInbox,
  getIsSearchingInbox,
  useMailboxPage,
} from "./mailbox-page";
import { useMailStore } from "./store";
import { useSyncAll } from "./use-sync-all";

interface LiveMailContextValue {
  accounts: MailAccountView[];
  canLoadMore: boolean;
  canSeedDemo: boolean;
  inboxMessages: InboxMessage[];
  isLoadingAccounts: boolean;
  isLoadingInbox: boolean;
  isLoadingMore: boolean;
  isSearchingInbox: boolean;
  isLoadingThread: boolean;
  isSeedingDemo: boolean;
  isSyncingAccounts: boolean;
  loadMore: () => void;
  markMessageRead: (message: InboxMessage) => void;
  removeFromRodge: (message: Pick<InboxMessage, "threadId">) => Promise<void>;
  replyToSelectedThread: () => void;
  seedDemoMail: () => Promise<void>;
  syncAllAccounts: () => Promise<void>;
  selectedMessageId: InboxMessage["_id"] | undefined;
  selectedThreadId: InboxMessage["threadId"] | undefined;
  selectedThread: MailThreadDetail | undefined;
  togglePinned: (message: InboxMessage) => Promise<void>;
  toggleRead: (message: InboxMessage) => Promise<void>;
  unreadCounts: Record<string, number>;
}

const LiveMailContext = createContext<LiveMailContextValue | undefined>(
  undefined,
);

export function LiveMailProvider({
  children,
  initialInbox,
}: {
  children: React.ReactNode;
  initialInbox: InboxMessage[];
}) {
  const value = useLiveMailValue(initialInbox);
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

function useLiveMailValue(initialInbox: InboxMessage[]) {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const debouncedSearchQuery = useMailStore(
    (store) => store.debouncedSearchQuery,
  );
  const searchQuery = useMailStore((store) => store.searchQuery);
  const selectedMessageId = useMailStore((store) => store.selectedMessageId);
  const selectedThreadId = useMailStore((store) => store.selectedThreadId);
  const setInitialSelection = useMailStore(
    (store) => store.setInitialSelection,
  );
  const queryState = useLiveMailQueries({
    accountFilter,
    debouncedSearchQuery,
    searchQuery,
    selectedMessageId,
    selectedThreadId,
    initialInbox,
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
  const actions = useLiveMailActions(
    queryState.accounts,
    queryState.selectedThread,
  );

  return {
    ...actions,
    ...queryState,
    unreadCounts: getLoadedUnreadCounts(queryState.inboxMessages),
  } satisfies LiveMailContextValue;
}

function useLiveMailQueries({
  accountFilter,
  debouncedSearchQuery,
  searchQuery,
  selectedMessageId,
  selectedThreadId,
  initialInbox,
}: {
  accountFilter: MailAccountFilter;
  debouncedSearchQuery: string;
  searchQuery: string;
  selectedMessageId: InboxMessage["_id"] | undefined;
  selectedThreadId: InboxMessage["threadId"] | undefined;
  initialInbox: InboxMessage[];
}) {
  const accountId = accountFilter === "all" ? undefined : accountFilter;
  const accountQuery = useAccountsQuery();
  const activePage = useMailboxPage({
    accountId,
    initialInbox,
    searchTerm: debouncedSearchQuery,
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
      debouncedSearchQuery,
      hasCachedPage: activePage.hasCachedPage,
      pageStatus: activePage.status,
      searchQuery,
    }),
    isLoadingMore: activePage.status === "LoadingMore",
    isSearchingInbox: getIsSearchingInbox({
      debouncedSearchQuery,
      pageStatus: activePage.status,
      searchQuery,
    }),
    isLoadingThread: effectiveThreadId !== undefined && threadQuery.isPending,
    loadMore: () => activePage.loadMore(MAIL_PAGE_SIZE),
    selectedMessageId: selectedMessageId ?? inboxMessages[0]?._id,
    selectedThreadId: effectiveThreadId,
    selectedThread: threadQuery.data,
  };
}

function canSeedDemoMail(accounts: MailAccountDocument[] | undefined) {
  return env.VITE_NODE_ENV === "development" && accounts?.length === 0;
}

function useAccountsQuery() {
  return useQuery({
    ...convexQuery(api.accounts.queries.list, {}),
    select: (accounts) => accounts,
  });
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

function useLiveMailActions(
  accounts: MailAccountView[],
  selectedThread: MailThreadDetail | undefined,
) {
  const navigate = useNavigate();
  const clearSelection = useMailStore((store) => store.clearSelection);
  const openReply = useMailStore((store) => store.openReply);
  const setThreadPinned = useMutation(api.mail.mutations.setThreadPinned);
  const setThreadRead = useMutation(api.mail.mutations.setThreadRead);
  const removeThreadFromRodge = useMutation(
    api.mail.mutations.removeThreadFromRodge,
  );
  const seedDemo = useMutation(api.devSeed.seedDemoMail);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const sync = useSyncAll(accounts);

  async function togglePinned(message: InboxMessage) {
    try {
      await setThreadPinned({
        threadId: message.threadId,
        isPinned: !message.isPinned,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update the pin."));
    }
  }

  async function toggleRead(message: InboxMessage) {
    try {
      await setThreadRead({
        threadId: message.threadId,
        isRead: !message.isRead,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update read status."));
    }
  }

  async function removeFromRodge(message: Pick<InboxMessage, "threadId">) {
    try {
      await removeThreadFromRodge({ threadId: message.threadId });
      clearSelection();
      await navigate({ to: "/", search: (previous) => previous });
      toast.success("Removed from Rodge. Your provider copy is unchanged.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not remove the conversation."));
    }
  }

  function markMessageRead(message: InboxMessage) {
    if (message.isRead) return;
    void setThreadRead({ threadId: message.threadId, isRead: true }).catch(
      (error) => {
        toast.error(getErrorMessage(error, "Could not mark the message read."));
      },
    );
  }

  function replyToSelectedThread() {
    const latestMessage = selectedThread?.messages.at(-1);
    if (!selectedThread || !latestMessage) return;
    const address = getReplyAddress(
      selectedThread.messages,
      selectedThread.account.address,
    );
    if (!address) return;
    openReply({
      accountId: selectedThread.accountId,
      address,
      messageId: latestMessage._id,
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
    ...sync,
    markMessageRead,
    removeFromRodge,
    replyToSelectedThread,
    seedDemoMail,
    togglePinned,
    toggleRead,
  };
}

function throwQueryError(error: Error | null) {
  if (error) throw error;
}
