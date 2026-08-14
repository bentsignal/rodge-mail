import type { OptimisticLocalStore } from "convex/browser";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

interface DeleteArchivedThreadArgs {
  threadId: Id<"threads">;
}

export function optimisticallyDeleteArchivedThread(
  store: OptimisticLocalStore,
  args: DeleteArchivedThreadArgs,
) {
  for (const query of store.getAllQueries(
    api.mail.archiveQueries.listArchive,
  )) {
    if (!query.value) continue;
    store.setQuery(api.mail.archiveQueries.listArchive, query.args, {
      ...query.value,
      page: removeArchivedThread(query.value.page, args.threadId),
    });
  }

  for (const query of store.getAllQueries(
    api.mail.archiveQueries.searchArchive,
  )) {
    if (!query.value) continue;
    store.setQuery(
      api.mail.archiveQueries.searchArchive,
      query.args,
      removeArchivedThread(query.value, args.threadId),
    );
  }
}

export function removeArchivedThread<T extends { threadId: string }>(
  threads: T[],
  threadId: string,
) {
  return threads.filter((thread) => thread.threadId !== threadId);
}
