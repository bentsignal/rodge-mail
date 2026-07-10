import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";

import type { Id } from "@rodge-mail/convex/model";
import type { MailAccountFilter } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { toConvexId } from "./convex-id";

interface SemanticResultState {
  accountFilter: MailAccountFilter;
  messageIds: Id<"messages">[];
  searchTerm: string;
}

export function useSemanticMessages({
  accountFilter,
  searchTerm,
}: {
  accountFilter: MailAccountFilter;
  searchTerm: string;
}) {
  const semanticSearch = useAction(api.embedding.search.semanticSearch);
  const [result, setResult] = useState<SemanticResultState>({
    accountFilter: "all",
    messageIds: [],
    searchTerm: "",
  });
  // eslint-disable-next-line no-restricted-syntax -- Vector search requires an action context and is synchronized to deferred input.
  useEffect(() => {
    if (searchTerm.length < 3) return;
    let active = true;
    void semanticSearch({
      accountId:
        accountFilter === "all"
          ? undefined
          : toConvexId<"mailAccounts">(accountFilter),
      searchTerm,
      limit: 16,
    })
      .then((matches) => {
        if (active) {
          setResult({
            accountFilter,
            messageIds: matches.map((match) => match.messageId),
            searchTerm,
          });
        }
      })
      .catch(() => {
        if (active) setResult({ accountFilter, messageIds: [], searchTerm });
      });
    return () => {
      active = false;
    };
  }, [accountFilter, searchTerm, semanticSearch]);
  const messageIds =
    result.accountFilter === accountFilter && result.searchTerm === searchTerm
      ? result.messageIds
      : [];
  return (
    useQuery(
      api.mail.queries.getMessagesByIds,
      messageIds.length > 0 ? { messageIds } : "skip",
    ) ?? []
  );
}
