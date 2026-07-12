import type { InboxMessage, MailAccountView, MailThreadDetail } from "./types";

export interface LiveMailContextValue {
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
  archiveThread: (message: Pick<InboxMessage, "threadId">) => Promise<void>;
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
