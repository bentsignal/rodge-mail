import type { OptimisticLocalStore } from "convex/browser";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

interface MoveThreadToInboxArgs {
  threadId: Id<"threads">;
}

const INBOX = { kind: "inbox" as const };

export function optimisticallyMoveThreadToInbox(
  store: OptimisticLocalStore,
  args: MoveThreadToInboxArgs,
) {
  for (const query of store.getAllQueries(api.mail.queries.listAllMail)) {
    if (!query.value) continue;
    store.setQuery(api.mail.queries.listAllMail, query.args, {
      ...query.value,
      page: moveRowsToInbox(query.value.page, args.threadId),
    });
  }
  for (const query of store.getAllQueries(api.mail.queries.searchHeaders)) {
    if (!query.value) continue;
    store.setQuery(api.mail.queries.searchHeaders, query.args, {
      ...query.value,
      page: moveRowsToInbox(query.value.page, args.threadId),
    });
  }
  for (const query of store.getAllQueries(api.mail.queries.getMessagesByIds)) {
    if (!query.value) continue;
    store.setQuery(
      api.mail.queries.getMessagesByIds,
      query.args,
      moveRowsToInbox(query.value, args.threadId),
    );
  }
  for (const query of store.getAllQueries(
    api.mail.archiveQueries.listArchive,
  )) {
    if (!query.value) continue;
    store.setQuery(api.mail.archiveQueries.listArchive, query.args, {
      ...query.value,
      page: query.value.page.filter((row) => row.threadId !== args.threadId),
    });
  }
  const thread = store.getQuery(api.mail.queries.getThread, args);
  if (!thread) return;
  store.setQuery(api.mail.queries.getThread, args, {
    ...thread,
    archivedAt: undefined,
    inInbox: true,
    messages: thread.messages.map((message) =>
      message.direction === "incoming"
        ? { ...message, archivedAt: undefined, inInbox: true, location: INBOX }
        : message,
    ),
  });
}

export function moveRowsToInbox<
  Row extends { archivedAt?: number; location: unknown; threadId: string },
>(rows: Row[], threadId: string) {
  return rows.map((row) =>
    row.threadId === threadId
      ? { ...row, archivedAt: undefined, location: INBOX }
      : row,
  );
}
