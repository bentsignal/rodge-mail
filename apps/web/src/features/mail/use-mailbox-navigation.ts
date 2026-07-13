import { useNavigate } from "@tanstack/react-router";

import type { MailAccountFilter } from "./store";
import { withMailboxSearch } from "./mail-route-search";
import { useMailStore } from "./store";

export function useMailboxNavigation(to: "/" | "/archive" = "/") {
  const navigate = useNavigate();
  const clearSelection = useMailStore((store) => store.clearSelection);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);

  return (accountFilter: MailAccountFilter) => {
    clearSelection();
    setAccountFilter(accountFilter);
    void navigate({
      to,
      search: (previous) => withMailboxSearch(previous, accountFilter),
    });
  };
}
