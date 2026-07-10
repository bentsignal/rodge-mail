import { useEffect, useState } from "react";
// eslint-disable-next-line no-restricted-imports -- Convex actions cannot be represented by convexQuery.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { InboxMessage } from "./types";

interface SemanticResultState {
  accountId: InboxMessage["accountId"] | undefined;
  messageIds: InboxMessage["_id"][];
  searchTerm: string;
}

export function useSemanticMessages({
  accountId,
  searchTerm,
}: {
  accountId: InboxMessage["accountId"] | undefined;
  searchTerm: string;
}) {
  const semanticSearch = useAction(api.embedding.search.semanticSearch);
  const [result, setResult] = useState<SemanticResultState>({
    accountId: undefined,
    messageIds: [],
    searchTerm: "",
  });
  // eslint-disable-next-line no-restricted-syntax -- Vector search requires an action context and is synchronized to deferred input.
  useEffect(() => {
    if (searchTerm.length < 3) return;
    let active = true;
    void semanticSearch({ accountId, searchTerm, limit: 16 })
      .then((matches) => {
        if (active) {
          setResult({
            accountId,
            messageIds: matches.map((match) => match.messageId),
            searchTerm,
          });
        }
      })
      .catch(() => {
        if (active) setResult({ accountId, messageIds: [], searchTerm });
      });
    return () => {
      active = false;
    };
  }, [accountId, searchTerm, semanticSearch]);
  const messageIds =
    result.accountId === accountId && result.searchTerm === searchTerm
      ? result.messageIds
      : [];
  const query = useQuery({
    ...convexQuery(
      api.mail.queries.getMessagesByIds,
      messageIds.length > 0 ? { messageIds } : "skip",
    ),
    select: (messages) => messages,
  });
  return query.data ?? [];
}
