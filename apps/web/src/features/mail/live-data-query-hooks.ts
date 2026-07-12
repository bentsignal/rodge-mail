// eslint-disable-next-line no-restricted-imports -- These route-preloaded queries are independent from the paginated mailbox view.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";

import { api } from "@rodge-mail/convex/api";

export function useAccountsQuery() {
  return useQuery({
    ...convexQuery(api.accounts.queries.list, {}),
    select: (accounts) => accounts,
  });
}

export function useUnreadCountQuery() {
  return useQuery({
    ...convexQuery(api.mail.queries.getUnreadCounts, {}),
    select: (counts) => counts,
  });
}
