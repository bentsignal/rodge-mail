import type { InboxMessage, MailAccountView, MailThreadDetail } from "./types";

export interface LiveMailContextValue {
  accounts: MailAccountView[];
  canLoadMore: boolean;
  canSeedDemo: boolean;
  inboxMessages: InboxMessage[];
  isLoadingAccounts: boolean;
  isLoadingInbox: boolean;
  isLoadingMore: boolean;
  isLoadingUnreadCounts: boolean;
  isSearchingInbox: boolean;
  isLoadingThread: boolean;
  isSeedingDemo: boolean;
  isSyncingAccounts: boolean;
  loadMore: () => void;
  mailMode: "archive" | "inbox";
  markMessageRead: (message: InboxMessage) => void;
  archiveThread: (message: Pick<InboxMessage, "threadId">) => Promise<void>;
  archiveThreads: (messages: Pick<InboxMessage, "threadId">[]) => Promise<void>;
  permanentlyDeleteArchivedThread: (
    message: Pick<InboxMessage, "threadId">,
  ) => Promise<void>;
  permanentlyDeleteArchivedThreads: (
    messages: Pick<InboxMessage, "threadId">[],
  ) => Promise<void>;
  replyToSelectedThread: () => void;
  restoreArchivedThread: (
    message: Pick<InboxMessage, "threadId">,
  ) => Promise<void>;
  restoreArchivedThreads: (
    messages: Pick<InboxMessage, "threadId">[],
  ) => Promise<void>;
  seedDemoMail: () => Promise<void>;
  syncAllAccounts: () => Promise<void>;
  selectedMessageId: InboxMessage["_id"] | undefined;
  selectedThreadId: InboxMessage["threadId"] | undefined;
  selectedThread: MailThreadDetail | undefined;
  togglePinned: (message: InboxMessage) => Promise<void>;
  toggleRead: (message: InboxMessage) => Promise<void>;
  setThreadsRead: (
    messages: Pick<InboxMessage, "threadId">[],
    isRead: boolean,
  ) => Promise<void>;
  unreadCounts: Record<string, number>;
}
