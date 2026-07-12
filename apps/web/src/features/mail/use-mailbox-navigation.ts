import { useNavigate } from "@tanstack/react-router";

import type { MailAccountFilter } from "./store";
import { withMailboxSearch } from "./mail-route-search";
import { useMailStore } from "./store";

export function useMailboxNavigation() {
  const navigate = useNavigate();
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);

  return (accountFilter: MailAccountFilter) => {
    setAccountFilter(accountFilter);
    void navigate({
      to: "/",
      search: (previous) => withMailboxSearch(previous, accountFilter),
    });
  };
}
