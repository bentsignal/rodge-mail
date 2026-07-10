import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { createStore } from "rostra";

import type {
  InboxCategory,
  MailAccountFilter,
} from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { toConvexId } from "./lib/convex-id";
import { toMailAccount, toMailThreads } from "./lib/convex-mail";

function useInternalStore() {
  const [accountFilter, setAccountFilter] = useState<MailAccountFilter>("all");
  const [category, setCategory] = useState<InboxCategory>("focused");
  const inbox = usePaginatedQuery(
    api.mail.queries.listInbox,
    {
      accountId:
        accountFilter === "all"
          ? undefined
          : toConvexId<"mailAccounts">(accountFilter),
      bucket: category,
    },
    { initialNumItems: 30 },
  );
  const accountRows = useQuery(api.accounts.queries.list, {});
  const setThreadPinned = useMutation(api.mail.mutations.setThreadPinned);
  const setThreadRead = useMutation(api.mail.mutations.setThreadRead);

  const messages = inbox.results;
  const threads = toMailThreads(messages);
  const accounts = accountRows?.map(toMailAccount) ?? [];

  function togglePin(threadId: string) {
    const thread = threads.find((item) => item.id === threadId);
    void setThreadPinned({
      threadId: toConvexId<"threads">(threadId),
      isPinned: !thread?.isPinned,
    });
  }

  function markRead(threadId: string) {
    void setThreadRead({
      threadId: toConvexId<"threads">(threadId),
      isRead: true,
    });
  }

  function toggleRead(threadId: string) {
    const thread = threads.find((item) => item.id === threadId);
    void setThreadRead({
      threadId: toConvexId<"threads">(threadId),
      isRead: !thread?.isRead,
    });
  }

  function loadMore() {
    if (inbox.status === "CanLoadMore") inbox.loadMore(30);
  }

  return {
    accountFilter,
    accounts,
    canLoadMore: inbox.status === "CanLoadMore",
    category,
    isLoading: inbox.status === "LoadingFirstPage",
    isLoadingMore: inbox.status === "LoadingMore",
    loadMore,
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
