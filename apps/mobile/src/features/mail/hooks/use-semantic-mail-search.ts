import type { FunctionReturnType } from "convex/server";
// eslint-disable-next-line no-restricted-imports -- Stable merged-result identity prevents the external query snapshot effect from retriggering unchanged rows.
import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import {
  getStrongSemanticMessageIds,
  mergeSearchResults,
} from "@rodge-mail/features/mail";

type InboxItem = FunctionReturnType<
  typeof api.mail.queries.listInbox
>["page"][number];

export function useSemanticMailSearch({
  accountId,
  lexicalResults,
  searchTerm,
}: {
  accountId: InboxItem["accountId"] | undefined;
  lexicalResults: InboxItem[];
  searchTerm: string;
}) {
  const runSemanticSearch = useAction(api.embedding.search.semanticSearch);
  const [result, setResult] = useState<{
    ids: InboxItem["_id"][];
    term: string;
  }>({ ids: [], term: "" });

  // eslint-disable-next-line no-restricted-syntax -- Semantic results supplement the immediately visible lexical query without blocking it.
  useEffect(() => {
    if (searchTerm.length < 2) return;
    let active = true;
    void runSemanticSearch({ accountId, searchTerm, limit: 30 })
      .then((matches) => {
        if (!active) return;
        setResult({
          ids: getStrongSemanticMessageIds(matches),
          term: searchTerm,
        });
      })
      .catch(() => {
        if (active) setResult({ ids: [], term: searchTerm });
      });
    return () => {
      active = false;
    };
  }, [accountId, runSemanticSearch, searchTerm]);

  const ids = result.term === searchTerm ? result.ids : [];
  const semanticResults = useQuery(
    api.mail.queries.getMessagesByIds,
    ids.length > 0 ? { messageIds: ids } : "skip",
  );
  const results = useMemo(
    () =>
      mergeSearchResults(
        lexicalResults,
        semanticResults ?? [],
        (message) => message._id,
      ),
    [lexicalResults, semanticResults],
  );
  return {
    isLoading:
      searchTerm.length >= 2 &&
      (result.term !== searchTerm ||
        (ids.length > 0 && semanticResults === undefined)),
    results,
  };
}
