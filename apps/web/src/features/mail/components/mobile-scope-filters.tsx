import { cn } from "@rodge-mail/std/cn";

import { QuickLink } from "~/components/quick-link";
import { useLiveMail } from "../live-data";
import { toMailboxLinkSearch } from "../mail-route-search";
import { useMailStore } from "../store";
import { useMailboxNavigation } from "../use-mailbox-navigation";
import { MAILBOXES } from "./account-rail-links";

function getChipClassName(active: boolean) {
  return cn(
    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground",
  );
}

/** The rail's mailbox and account choices, for widths where the rail is hidden. */
export function MobileScopeFilters() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const clearSelection = useMailStore((store) => store.clearSelection);
  const { accounts, mailMode } = useLiveMail();
  const selectAccount = useMailboxNavigation(mailMode);

  return (
    <div className="mt-3 space-y-2 md:hidden">
      <nav
        aria-label="Mailboxes"
        className="mail-scrollbar flex gap-2 overflow-x-auto pb-1"
      >
        {MAILBOXES.map((mailbox) => (
          <QuickLink
            aria-current={mailMode === mailbox.mode ? "page" : undefined}
            className={getChipClassName(mailMode === mailbox.mode)}
            key={mailbox.mode}
            onClick={clearSelection}
            search={toMailboxLinkSearch}
            to={mailbox.to}
          >
            {mailbox.label}
          </QuickLink>
        ))}
      </nav>
      <div
        aria-label="Accounts"
        className="mail-scrollbar flex gap-2 overflow-x-auto pb-1"
        role="group"
      >
        <AccountChip
          active={accountFilter === "all"}
          label="All Accounts"
          onClick={() => selectAccount("all")}
        />
        {accounts.map((account) => (
          <AccountChip
            active={accountFilter === account._id}
            key={account._id}
            label={account.label}
            onClick={() => selectAccount(account._id)}
          />
        ))}
      </div>
    </div>
  );
}

function AccountChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={getChipClassName(active)}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
