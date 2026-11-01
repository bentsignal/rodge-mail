import type { FunctionReturnType } from "convex/server";

import type { api } from "@rodge-mail/convex/api";

export type SentRow = FunctionReturnType<
  typeof api.outbox.queries.listUnsent
>[number];

export function filterSentRows(rows: SentRow[], searchTerm: string) {
  const query = searchTerm.trim().toLocaleLowerCase();
  if (!query) return rows;
  return rows.filter((row) =>
    [
      row.subject,
      row.snippet,
      ...row.to.flatMap((recipient) => [recipient.name, recipient.address]),
    ]
      .join("\n")
      .toLocaleLowerCase()
      .includes(query),
  );
}
