import { useState } from "react";
import { createStore } from "rostra";

import type {
  InboxCategory,
  MailAccountFilter,
  MailThread,
} from "@rodge-mail/features/mail";
import { DEMO_MAIL_THREADS } from "@rodge-mail/features/mail";

function useInternalStore() {
  const [threads, setThreads] = useState<MailThread[]>(() =>
    DEMO_MAIL_THREADS.map((thread) => ({ ...thread })),
  );
  const [accountFilter, setAccountFilter] = useState<MailAccountFilter>("all");
  const [category, setCategory] = useState<InboxCategory>("focused");

  function togglePin(threadId: string) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? { ...thread, isPinned: !thread.isPinned }
          : thread,
      ),
    );
  }

  function markRead(threadId: string) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? { ...thread, isRead: true } : thread,
      ),
    );
  }

  function toggleRead(threadId: string) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? { ...thread, isRead: !thread.isRead } : thread,
      ),
    );
  }

  return {
    accountFilter,
    category,
    markRead,
    setAccountFilter,
    setCategory,
    threads,
    togglePin,
    toggleRead,
  };
}

export const { Store: MailStore, useStore: useMailStore } =
  createStore(useInternalStore);
