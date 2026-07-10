import { useState } from "react";
import { createStore } from "rostra";

import type {
  ComposerDraft,
  InboxCategory,
  MailAccount,
  MailAccountFilter,
  MailThread,
} from "@rodge-mail/features/mail";

interface MailStoreProps {
  initialAccounts: MailAccount[];
  initialThreads: MailThread[];
}

function createEmptyDraft() {
  return {
    attachments: [],
    body: "",
    cc: "",
    subject: "",
    to: "",
  };
}

function getVisibleThreads({
  accountFilter,
  category,
  searchQuery,
  threads,
}: {
  accountFilter: MailAccountFilter;
  category: InboxCategory;
  searchQuery: string;
  threads: MailThread[];
}) {
  const query = searchQuery.trim().toLocaleLowerCase();
  return threads
    .filter((thread) => {
      if (accountFilter !== "all" && thread.accountId !== accountFilter) {
        return false;
      }
      if (query.length === 0) return thread.category === category;

      const searchable = [
        thread.sender.name,
        thread.sender.address,
        thread.subject,
        thread.preview,
        ...thread.messages.flatMap((message) => message.body),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(query);
    })
    .slice()
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
      return right.receivedAt.localeCompare(left.receivedAt);
    });
}

function getUnreadCounts(threads: MailThread[]) {
  const counts = new Map<string, number>([["all", 0]]);
  for (const thread of threads) {
    if (thread.isRead) continue;
    counts.set("all", (counts.get("all") ?? 0) + 1);
    counts.set(thread.accountId, (counts.get(thread.accountId) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}

function useComposerState(selectedThread: MailThread | undefined) {
  const [composerIsOpen, setComposerIsOpen] = useState(false);
  const [composerDraft, setComposerDraft] =
    useState<ComposerDraft>(createEmptyDraft);
  const [deliveryNotice, setDeliveryNotice] = useState<string>();
  const composerCanSend =
    composerDraft.to.trim().length > 0 &&
    (composerDraft.subject.trim().length > 0 ||
      composerDraft.body.trim().length > 0);

  function updateComposerDraft(
    field: "body" | "cc" | "subject" | "to",
    value: string,
  ) {
    setComposerDraft((current) => ({ ...current, [field]: value }));
  }

  function addComposerAttachments(fileNames: string[]) {
    setComposerDraft((current) => ({
      ...current,
      attachments: [...new Set([...current.attachments, ...fileNames])],
    }));
  }

  function replyToSelectedThread() {
    if (!selectedThread) return;
    setComposerDraft({
      ...createEmptyDraft(),
      subject: selectedThread.subject.startsWith("Re:")
        ? selectedThread.subject
        : `Re: ${selectedThread.subject}`,
      to: selectedThread.sender.address,
    });
    setComposerIsOpen(true);
  }

  function sendComposerDraft() {
    if (!composerCanSend) return;
    setDeliveryNotice(`Message queued for ${composerDraft.to}`);
    setComposerIsOpen(false);
    setComposerDraft(createEmptyDraft());
  }

  return {
    addComposerAttachments,
    closeComposer: () => setComposerIsOpen(false),
    composerCanSend,
    composerDraft,
    composerIsOpen,
    deliveryNotice,
    dismissDeliveryNotice: () => setDeliveryNotice(undefined),
    openComposer: () => {
      setComposerDraft(createEmptyDraft());
      setComposerIsOpen(true);
    },
    removeComposerAttachment: (fileName: string) =>
      setComposerDraft((current) => ({
        ...current,
        attachments: current.attachments.filter((name) => name !== fileName),
      })),
    replyToSelectedThread,
    sendComposerDraft,
    updateComposerDraft,
  };
}

function useInternalStore({ initialAccounts, initialThreads }: MailStoreProps) {
  const [threads, setThreads] = useState(initialThreads);
  const [accountFilter, setAccountFilter] = useState<MailAccountFilter>("all");
  const [category, setCategory] = useState<InboxCategory>("focused");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState(
    initialThreads[0]?.id,
  );
  const [mobileReaderIsOpen, setMobileReaderIsOpen] = useState(false);
  const visibleThreads = getVisibleThreads({
    accountFilter,
    category,
    searchQuery,
    threads,
  });
  const selectedThread =
    visibleThreads.find((thread) => thread.id === selectedThreadId) ??
    visibleThreads[0];
  const composer = useComposerState(selectedThread);

  function selectThread(threadId: string) {
    setSelectedThreadId(threadId);
    setMobileReaderIsOpen(true);
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? { ...thread, isRead: true } : thread,
      ),
    );
  }

  function toggleThreadFlag(threadId: string, flag: "isPinned" | "isRead") {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? { ...thread, [flag]: !thread[flag] } : thread,
      ),
    );
  }

  return {
    ...composer,
    accounts: initialAccounts,
    accountFilter,
    category,
    closeMobileReader: () => setMobileReaderIsOpen(false),
    mobileReaderIsOpen,
    searchQuery,
    selectThread,
    selectedThread,
    setAccountFilter,
    setCategory,
    setSearchQuery,
    threads,
    togglePinned: (threadId: string) => toggleThreadFlag(threadId, "isPinned"),
    toggleRead: (threadId: string) => toggleThreadFlag(threadId, "isRead"),
    unreadCounts: getUnreadCounts(threads),
    visibleThreads,
  };
}

export const { Store: MailStore, useStore: useMailStore } = createStore<
  MailStoreProps,
  ReturnType<typeof useInternalStore>
>(useInternalStore);
