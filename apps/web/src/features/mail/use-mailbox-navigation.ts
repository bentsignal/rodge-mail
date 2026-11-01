import { useNavigate } from "@tanstack/react-router";

import type { MailMode } from "./live-data-types";
import type { MailAccountFilter } from "./store";
import { getMailModePath } from "./live-data-types";
import { withMailboxSearch } from "./mail-route-search";
import { useMailStore } from "./store";

/** Changes the account shown, staying in the current mailbox. */
export function useMailboxNavigation(mailMode: MailMode) {
  const navigate = useNavigate();
  const clearSelection = useMailStore((store) => store.clearSelection);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);

  return (accountFilter: MailAccountFilter) => {
    clearSelection();
    setAccountFilter(accountFilter);
    void navigate({
      to: getMailModePath(mailMode),
      search: (previous) => withMailboxSearch(previous, accountFilter),
    });
  };
}
