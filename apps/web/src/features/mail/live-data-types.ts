import type { InboxMessage, MailAccountView, MailThreadDetail } from "./types";

export type MailMode = "all" | "archive" | "inbox" | "sent" | "spam";

export function getMailModePath(mailMode: MailMode) {
  if (mailMode === "all") return "/all";
  if (mailMode === "archive") return "/archive";
  if (mailMode === "spam") return "/spam";
  if (mailMode === "sent") return "/sent";
  return "/";
}

export function isAllMailPath(pathname: string) {
  return pathname === "/all" || pathname.startsWith("/all/");
}

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
  mailMode: MailMode;
  markMessageRead: (message: InboxMessage) => void;
  moveThreadToInbox: (message: Pick<InboxMessage, "threadId">) => void;
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
  setThreadsRead: (messages: InboxMessage[], isRead: boolean) => Promise<void>;
  unreadCounts: Record<string, number>;
}
