import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { createStore } from "rostra";

import type {
  InboxCategory,
  MailAccountFilter,
} from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { toMailAccount, toMailThread } from "./lib/convex-mail";

function useInternalStore() {
  const [accountFilter, setAccountFilter] = useState<MailAccountFilter>("all");
  const [category, setCategory] = useState<InboxCategory>("focused");
  const inbox = usePaginatedQuery(
    api.mail.queries.listInbox,
    {},
    { initialNumItems: 30 },
  );
  const accountRows = useQuery(api.accounts.queries.list, {});
  const setPinned = useMutation(api.mail.mutations.setPinned);
  const setRead = useMutation(api.mail.mutations.setRead);

  const messages = inbox.results;
  const threads = messages.map(toMailThread);
  const accounts = accountRows?.map(toMailAccount) ?? [];

  function getMessage(threadId: string) {
    return messages.find((message) => message._id === threadId);
  }

  function togglePin(threadId: string) {
    const message = getMessage(threadId);
    if (!message) return;
    void setPinned({ messageId: message._id, isPinned: !message.isPinned });
  }

  function markRead(threadId: string) {
    const message = getMessage(threadId);
    if (!message || message.isRead) return;
    void setRead({ messageId: message._id, isRead: true });
  }

  function toggleRead(threadId: string) {
    const message = getMessage(threadId);
    if (!message) return;
    void setRead({ messageId: message._id, isRead: !message.isRead });
  }

  function loadMore() {
    if (inbox.status === "CanLoadMore") inbox.loadMore(30);
  }

  return {
    accountFilter,
    accounts,
    canLoadMore: inbox.status === "CanLoadMore",
    category,
    getMessageId: (threadId: string) => getMessage(threadId)?._id,
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
