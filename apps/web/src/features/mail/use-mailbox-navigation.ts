import { useNavigate } from "@tanstack/react-router";

import type { MailAccountFilter } from "./store";
import { useMailStore } from "./store";

export function useMailboxNavigation() {
  const navigate = useNavigate();
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);

  return (accountFilter: MailAccountFilter) => {
    setAccountFilter(accountFilter);
    void navigate({
      to: "/",
      search: {
        mailbox: accountFilter === "all" ? undefined : accountFilter,
      },
    });
  };
}
