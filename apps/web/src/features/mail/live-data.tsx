import { createContext, use, useEffect, useState } from "react";
// eslint-disable-next-line no-restricted-imports -- Mail has intentional loading states and a selection-dependent thread query.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import { getReplyAddress } from "@rodge-mail/features/mail";
import { toast } from "@rodge-mail/ui-web/toast";

import type { LiveMailContextValue } from "./live-data-types";
import type { MailAccountFilter } from "./store";
import type {
  InboxMessage,
  MailAccountDocument,
  MailAccountView,
  MailThreadDetail,
} from "./types";
import { env } from "~/env";
import { MAIL_PAGE_SIZE } from "./constants";
import { useAccountsQuery, useUnreadCountQuery } from "./live-data-query-hooks";
import {
  getErrorMessage,
  sortInboxMessages,
  toAccountView,
  toUnreadCountRecord,
} from "./live-data-utils";
import {
  getIsLoadingInbox,
  getIsSearchingInbox,
  useMailboxPage,
} from "./mailbox-page";
import { useMailStore } from "./store";
import { optimisticallySetThreadRead } from "./unread-optimistic";
import { useSyncAll } from "./use-sync-all";
import { useUnreadSelectionSync } from "./use-unread-selection-sync";

const LiveMailContext = createContext<LiveMailContextValue | undefined>(
  undefined,
);

export function LiveMailProvider({
  children,
  initialAccountFilter,
  initialInbox,
  initialUnreadOnly,
}: {
  children: React.ReactNode;
  initialAccountFilter: MailAccountFilter;
  initialInbox: InboxMessage[];
  initialUnreadOnly: boolean;
}) {
  const value = useLiveMailValue({
    initialAccountFilter,
    initialInbox,
    initialUnreadOnly,
  });
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

function useLiveMailValue({
  initialAccountFilter,
  initialInbox,
  initialUnreadOnly,
}: {
  initialAccountFilter: MailAccountFilter;
  initialInbox: InboxMessage[];
  initialUnreadOnly: boolean;
}) {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const debouncedSearchQuery = useMailStore(
    (store) => store.debouncedSearchQuery,
  );
  const searchQuery = useMailStore((store) => store.searchQuery);
  const selectedMessageId = useMailStore((store) => store.selectedMessageId);
  const selectedThreadId = useMailStore((store) => store.selectedThreadId);
  const unreadOnly = useMailStore((store) => store.unreadOnly);
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
    initialAccountFilter,
    initialUnreadOnly,
    unreadOnly,
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
  useUnreadSelectionSync({
    inboxMessages: queryState.inboxMessages,
    isLoadingInbox: queryState.isLoadingInbox,
    isLoadingThread: queryState.isLoadingThread,
    selectedThread: queryState.selectedThread,
    selectedThreadId,
    unreadOnly,
  });
  const actions = useLiveMailActions(
    queryState.accounts,
    queryState.selectedThread,
  );

  return {
    ...actions,
    ...queryState,
  } satisfies LiveMailContextValue;
}

function useLiveMailQueries({
  accountFilter,
  debouncedSearchQuery,
  searchQuery,
  selectedMessageId,
  selectedThreadId,
  initialInbox,
  initialAccountFilter,
  initialUnreadOnly,
  unreadOnly,
}: {
  accountFilter: MailAccountFilter;
  debouncedSearchQuery: string;
  searchQuery: string;
  selectedMessageId: InboxMessage["_id"] | undefined;
  selectedThreadId: InboxMessage["threadId"] | undefined;
  initialInbox: InboxMessage[];
  initialAccountFilter: MailAccountFilter;
  initialUnreadOnly: boolean;
  unreadOnly: boolean;
}) {
  const accountId = accountFilter === "all" ? undefined : accountFilter;
  const accountQuery = useAccountsQuery();
  const unreadCountQuery = useUnreadCountQuery();
  const activePage = useMailboxPage({
    accountId,
    initialAccountId:
      initialAccountFilter === "all" ? undefined : initialAccountFilter,
    initialInbox,
    initialUnreadOnly,
    searchTerm: debouncedSearchQuery,
    unreadOnly,
  });
  const inboxMessages = sortInboxMessages(activePage.results);
  const effectiveThreadId = selectedThreadId ?? inboxMessages[0]?.threadId;
  const threadQuery = useThreadQuery(effectiveThreadId);
  throwQueryError(accountQuery.error);
  throwQueryError(threadQuery.error);
  throwQueryError(unreadCountQuery.error);

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
    unreadCounts: unreadCountQuery.data
      ? toUnreadCountRecord(unreadCountQuery.data)
      : {},
  };
}

function canSeedDemoMail(accounts: MailAccountDocument[] | undefined) {
  return env.VITE_NODE_ENV === "development" && accounts?.length === 0;
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
  const setThreadRead = useMutation(
    api.mail.mutations.setThreadRead,
  ).withOptimisticUpdate(optimisticallySetThreadRead);
  const archiveThreadMutation = useMutation(api.mail.mutations.archiveThread);
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

  async function archiveThread(message: Pick<InboxMessage, "threadId">) {
    try {
      await archiveThreadMutation({ threadId: message.threadId });
      clearSelection();
      await navigate({ to: "/", search: (previous) => previous });
      toast.success("Archived in Rodge. Your provider copy is unchanged.");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Could not archive the conversation."),
      );
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
    archiveThread,
    replyToSelectedThread,
    seedDemoMail,
    togglePinned,
    toggleRead,
  };
}

function throwQueryError(error: Error | null) {
  if (error) throw error;
}
