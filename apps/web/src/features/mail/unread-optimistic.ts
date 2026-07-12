import type { OptimisticLocalStore } from "convex/browser";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

interface SetThreadReadArgs {
  isRead: boolean;
  threadId: Id<"threads">;
}

export function optimisticallySetThreadRead(
  store: OptimisticLocalStore,
  args: SetThreadReadArgs,
) {
  const source = findThreadRow(store, args.threadId);
  if (!source || source.isRead === args.isRead) return;

  updateUnreadCountQuery(store, source.accountId, args.isRead);
  updateInboxQueries(store, args);
  updateSearchQueries(store, args);
  updateMessageHydrationQueries(store, args);
  updateThreadQuery(store, args);
}

function findThreadRow(store: OptimisticLocalStore, threadId: Id<"threads">) {
  for (const query of store.getAllQueries(api.mail.queries.listInbox)) {
    const row = query.value?.page.find((item) => item.threadId === threadId);
    if (row) return row;
  }
  for (const query of store.getAllQueries(api.mail.queries.searchHeaders)) {
    const row = query.value?.page.find((item) => item.threadId === threadId);
    if (row) return row;
  }
  return undefined;
}

function updateUnreadCountQuery(
  store: OptimisticLocalStore,
  accountId: Id<"mailAccounts">,
  isRead: boolean,
) {
  const current = store.getQuery(api.mail.queries.getUnreadCounts, {});
  if (!current) return;
  store.setQuery(
    api.mail.queries.getUnreadCounts,
    {},
    getOptimisticUnreadCounts(current, accountId, isRead),
  );
}

function updateInboxQueries(
  store: OptimisticLocalStore,
  args: SetThreadReadArgs,
) {
  for (const query of store.getAllQueries(api.mail.queries.listInbox)) {
    if (!query.value) continue;
    const page = updateOptimisticThreadRows(
      query.value.page,
      args,
      query.args.unreadOnly === true,
    );
    store.setQuery(api.mail.queries.listInbox, query.args, {
      ...query.value,
      page,
    });
  }
}

function updateSearchQueries(
  store: OptimisticLocalStore,
  args: SetThreadReadArgs,
) {
  for (const query of store.getAllQueries(api.mail.queries.searchHeaders)) {
    if (!query.value) continue;
    const page = updateOptimisticThreadRows(
      query.value.page,
      args,
      query.args.unreadOnly === true,
    );
    store.setQuery(api.mail.queries.searchHeaders, query.args, {
      ...query.value,
      page,
    });
  }
}

function updateMessageHydrationQueries(
  store: OptimisticLocalStore,
  args: SetThreadReadArgs,
) {
  for (const query of store.getAllQueries(api.mail.queries.getMessagesByIds)) {
    if (!query.value) continue;
    store.setQuery(
      api.mail.queries.getMessagesByIds,
      query.args,
      updateOptimisticThreadRows(
        query.value,
        args,
        query.args.unreadOnly === true,
      ),
    );
  }
}

function updateThreadQuery(
  store: OptimisticLocalStore,
  args: SetThreadReadArgs,
) {
  const current = store.getQuery(api.mail.queries.getThread, {
    threadId: args.threadId,
  });
  if (!current) return;
  store.setQuery(
    api.mail.queries.getThread,
    { threadId: args.threadId },
    {
      ...current,
      messages: current.messages.map((message) => ({
        ...message,
        isRead: args.isRead,
      })),
      unreadCount: args.isRead ? 0 : Math.max(1, current.messages.length),
    },
  );
}

export function updateOptimisticThreadRows<
  Item extends { isRead: boolean; threadId: string },
>(
  items: Item[],
  args: { isRead: boolean; threadId: string },
  unreadOnly: boolean,
) {
  if (unreadOnly && args.isRead) {
    return items.filter((item) => item.threadId !== args.threadId);
  }
  return items.map((item) =>
    item.threadId === args.threadId ? { ...item, isRead: args.isRead } : item,
  );
}

export function getOptimisticUnreadCounts(
  current: { all: number; byAccount: Record<string, number> },
  accountId: string,
  isRead: boolean,
) {
  const delta = isRead ? -1 : 1;
  return {
    all: Math.max(0, current.all + delta),
    byAccount: {
      ...current.byAccount,
      [accountId]: Math.max(0, (current.byAccount[accountId] ?? 0) + delta),
    },
  };
}
