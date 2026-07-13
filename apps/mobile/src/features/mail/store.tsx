import { useEffect, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { createStore } from "rostra";

import type { MailAccountFilter } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import {
  readCachedAccountPage,
  sortPinnedMailRows,
} from "@rodge-mail/features/mail";

import { toConvexId } from "./lib/convex-id";
import { toMailAccount, toMailThreads } from "./lib/convex-mail";

interface ThreadOverride {
  isPinned?: boolean;
  isRead?: boolean;
}

export type MobileMailbox = "archive" | "inbox";

function useInternalStore() {
  const [accountFilter, setAccountFilter] = useState<MailAccountFilter>("all");
  const [mailbox, setMailbox] = useState<MobileMailbox>("inbox");
  const inbox = usePaginatedQuery(
    api.mail.queries.listInbox,
    {
      accountId:
        accountFilter === "all"
          ? undefined
          : toConvexId<"mailAccounts">(accountFilter),
    },
    { initialNumItems: 30 },
  );
  const accountRows = useQuery(api.accounts.queries.list, {});
  const setThreadPinned = useMutation(api.mail.mutations.setThreadPinned);
  const [threadCache, setThreadCache] = useState(
    () => new Map<MailAccountFilter, ReturnType<typeof toMailThreads>>(),
  );
  const [threadOverrides, setThreadOverrides] = useState<
    Record<string, ThreadOverride>
  >({});
  const { archivedThreadIds, archiveThread } = useArchiveThread();

  const messages = inbox.results;
  const liveThreads = toMailThreads(messages);
  const hasLivePage = inbox.status !== "LoadingFirstPage";
  const cachedPage = readCachedAccountPage({
    accountId: accountFilter === "all" ? undefined : accountFilter,
    cache: threadCache,
    key: accountFilter,
    unifiedKey: "all",
  });
  const visibleThreads = hasLivePage ? liveThreads : cachedPage.items;
  const threads = sortPinnedMailRows(
    applyThreadOverrides(visibleThreads, threadOverrides).filter(
      (thread) => !archivedThreadIds.has(thread.id),
    ),
  );
  const accounts = accountRows?.map(toMailAccount) ?? [];
  const { markRead, toggleRead } = useReadActions(threads, setThreadOverrides);

  // eslint-disable-next-line no-restricted-syntax -- Cache the latest settled Convex subscription page for instant mailbox revisits.
  useEffect(() => {
    if (!hasLivePage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The Convex page is an external subscription snapshot.
    setThreadCache((current) => {
      const next = new Map(current);
      next.set(accountFilter, toMailThreads(messages));
      return next;
    });
  }, [accountFilter, hasLivePage, messages]);

  // eslint-disable-next-line no-restricted-syntax -- Reconcile local optimistic state when the Convex subscription confirms it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The Convex snapshot confirms or rejects the optimistic overlay.
    setThreadOverrides((current) =>
      removeConfirmedOverrides(current, toMailThreads(messages)),
    );
  }, [messages]);

  async function togglePin(threadId: string, isPinned: boolean) {
    const nextIsPinned = !isPinned;
    setThreadOverride(setThreadOverrides, threadId, {
      isPinned: nextIsPinned,
    });
    try {
      await setThreadPinned({
        threadId: toConvexId<"threads">(threadId),
        isPinned: nextIsPinned,
      });
    } catch {
      clearThreadOverride(setThreadOverrides, threadId, "isPinned");
    }
  }

  function loadMore() {
    if (inbox.status === "CanLoadMore") inbox.loadMore(30);
  }

  return {
    accountFilter,
    accounts,
    archiveThread,
    canLoadMore: inbox.status === "CanLoadMore",
    isLoading: inbox.status === "LoadingFirstPage" && !cachedPage.isCached,
    isLoadingMore: inbox.status === "LoadingMore",
    loadMore,
    mailbox,
    markRead,
    setAccountFilter,
    setMailbox,
    threads,
    togglePin,
    toggleRead,
  };
}

export const { Store: MailStore, useStore: useMailStore } =
  createStore(useInternalStore);

function useArchiveThread() {
  const archiveThreadMutation = useMutation(api.mail.mutations.archiveThread);
  const [archivedThreadIds, setArchivedThreadIds] = useState(
    () => new Set<string>(),
  );

  async function archiveThread(threadId: string) {
    setArchivedThreadIds((current) => new Set(current).add(threadId));
    try {
      await archiveThreadMutation({
        threadId: toConvexId<"threads">(threadId),
      });
    } catch {
      setArchivedThreadIds((current) => {
        const next = new Set(current);
        next.delete(threadId);
        return next;
      });
    }
  }

  return { archivedThreadIds, archiveThread };
}

function useReadActions(
  threads: ReturnType<typeof toMailThreads>,
  setThreadOverrides: React.Dispatch<
    React.SetStateAction<Record<string, ThreadOverride>>
  >,
) {
  const setThreadRead = useMutation(api.mail.mutations.setThreadRead);

  async function setRead(threadId: string, isRead: boolean) {
    setThreadOverride(setThreadOverrides, threadId, { isRead });
    try {
      await setThreadRead({
        threadId: toConvexId<"threads">(threadId),
        isRead,
      });
    } catch {
      clearThreadOverride(setThreadOverrides, threadId, "isRead");
    }
  }

  function markRead(threadId: string) {
    const thread = threads.find((candidate) => candidate.id === threadId);
    if (thread?.isRead) return;
    void setRead(threadId, true);
  }

  async function toggleRead(threadId: string, isRead: boolean) {
    await setRead(threadId, !isRead);
  }

  return { markRead, toggleRead };
}

function applyThreadOverrides(
  threads: ReturnType<typeof toMailThreads>,
  overrides: Record<string, ThreadOverride>,
) {
  return sortPinnedMailRows(
    threads.map((thread) => ({ ...thread, ...overrides[thread.id] })),
  );
}

function removeConfirmedOverrides(
  overrides: Record<string, ThreadOverride>,
  threads: ReturnType<typeof toMailThreads>,
) {
  const next = { ...overrides };
  let changed = false;
  for (const thread of threads) {
    const override = overrides[thread.id];
    if (!override) continue;
    const isPinnedConfirmed =
      override.isPinned === undefined || override.isPinned === thread.isPinned;
    const isReadConfirmed =
      override.isRead === undefined || override.isRead === thread.isRead;
    if (!isPinnedConfirmed || !isReadConfirmed) continue;
    delete next[thread.id];
    changed = true;
  }
  return changed ? next : overrides;
}

function setThreadOverride(
  setOverrides: React.Dispatch<
    React.SetStateAction<Record<string, ThreadOverride>>
  >,
  threadId: string,
  override: ThreadOverride,
) {
  setOverrides((current) => ({
    ...current,
    [threadId]: { ...current[threadId], ...override },
  }));
}

function clearThreadOverride(
  setOverrides: React.Dispatch<
    React.SetStateAction<Record<string, ThreadOverride>>
  >,
  threadId: string,
  key: keyof ThreadOverride,
) {
  setOverrides((current) => {
    const existing = current[threadId];
    if (existing?.[key] === undefined) return current;
    const nextOverride = { ...existing };
    delete nextOverride[key];
    const next = { ...current };
    if (Object.keys(nextOverride).length === 0) delete next[threadId];
    else next[threadId] = nextOverride;
    return next;
  });
}
