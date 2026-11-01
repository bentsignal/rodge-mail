import type { OptimisticLocalStore } from "convex/browser";
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

interface RemoveAccountArgs {
  accountId: Id<"mailAccounts">;
}

type QueryRef<Args extends DefaultFunctionArgs, Value> = FunctionReference<
  "query",
  "public",
  Args,
  Value
>;

/** The account and its mail leave every list the moment removal is confirmed. */
export function optimisticallyRemoveAccount(
  store: OptimisticLocalStore,
  { accountId }: RemoveAccountArgs,
) {
  const accounts = store.getQuery(api.accounts.queries.list, {});
  const address = accounts?.find(
    (account) => account._id === accountId,
  )?.address;
  if (accounts) {
    store.setQuery(
      api.accounts.queries.list,
      {},
      accounts.filter((account) => account._id !== accountId),
    );
  }

  function keep(item: { accountId: string }) {
    return item.accountId !== accountId;
  }
  filterPages(store, api.mail.queries.listInbox, keep);
  filterPages(store, api.mail.queries.listPinned, keep);
  filterPages(store, api.mail.queries.searchHeaders, keep);
  filterPages(store, api.mail.queries.listSpam, keep);
  filterPages(store, api.mail.archiveQueries.listArchive, keep);
  filterLists(store, api.mail.queries.getMessagesByIds, keep);
  filterLists(store, api.mail.archiveQueries.searchArchive, keep);
  filterLists(store, api.notifications.queries.listAccountPreferences, keep);

  function keepOutbox(row: { account: { _id: string } }) {
    return row.account._id !== accountId;
  }
  filterLists(store, api.outbox.queries.listUnsent, keepOutbox);
  filterPages(store, api.outbox.queries.listSent, keepOutbox);
  filterLists(
    store,
    api.outbox.queries.listRecent,
    (row) => row.account.address !== address,
  );

  const unread = store.getQuery(api.mail.queries.getUnreadCounts, {});
  if (unread) {
    const { [accountId]: removed = 0, ...byAccount } = unread.byAccount;
    store.setQuery(
      api.mail.queries.getUnreadCounts,
      {},
      { all: Math.max(0, unread.all - removed), byAccount },
    );
  }
}

function filterPages<Args extends DefaultFunctionArgs, Item>(
  store: OptimisticLocalStore,
  query: QueryRef<Args, { page: Item[] }>,
  keep: (item: Item) => boolean,
) {
  for (const { args, value } of store.getAllQueries(query)) {
    if (!value) continue;
    store.setQuery(query, args, { ...value, page: value.page.filter(keep) });
  }
}

function filterLists<Args extends DefaultFunctionArgs, Item>(
  store: OptimisticLocalStore,
  query: QueryRef<Args, Item[]>,
  keep: (item: Item) => boolean,
) {
  for (const { args, value } of store.getAllQueries(query)) {
    if (!value) continue;
    store.setQuery(query, args, value.filter(keep));
  }
}
