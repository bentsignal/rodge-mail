import { PenLine, Search, X } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { MailAccountView } from "../types";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { ThreadList } from "./thread-list";

export function InboxPane() {
  const mobileReaderIsOpen = useMailStore((store) => store.mobileReaderIsOpen);

  return (
    <section
      aria-label="Inbox"
      className={cn(
        "min-w-0 flex-1 flex-col border-r border-[var(--mail-seam)] bg-[var(--mail-paper-soft)] lg:max-w-[430px] lg:min-w-[360px] lg:flex-none xl:max-w-[460px]",
        mobileReaderIsOpen ? "hidden lg:flex" : "flex",
      )}
    >
      <InboxHeader />
      <ThreadList />
    </section>
  );
}

function InboxHeader() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const openComposer = useMailStore((store) => store.openComposer);
  const { accounts, inboxMessages, isLoadingInbox } = useLiveMail();
  const currentAccount =
    accountFilter === "all"
      ? undefined
      : accounts.find((account) => account._id === accountFilter);

  return (
    <header className="mail-paper shrink-0 border-b border-[var(--mail-seam)] px-4 pt-4 pb-3.5 shadow-[0_2px_6px_rgba(55,40,19,0.08)] sm:px-5 sm:pt-5 dark:shadow-[0_2px_8px_rgba(0,0,0,0.22)]">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <MobileBrand />
            <p className="mail-label font-mono text-[9px] tracking-[0.18em] uppercase">
              {getMailboxContextLabel(currentAccount)}
            </p>
          </div>
          <div className="mt-1.5 flex items-end gap-2.5">
            <h1 className="font-serif text-[32px] leading-none font-semibold tracking-[-0.04em] sm:text-[35px]">
              Inbox
            </h1>
            <InboxCount
              count={inboxMessages.length}
              isLoading={isLoadingInbox}
            />
          </div>
        </div>
        <button
          aria-label="New message"
          className="mail-brass-button flex size-10 items-center justify-center rounded-[10px] transition-colors md:hidden"
          onClick={openComposer}
          type="button"
        >
          <PenLine className="size-4" />
        </button>
      </div>
      <SearchInput />
      <MobileAccountFilters />
      <SearchResultsLabel />
    </header>
  );
}

function InboxCount({
  count,
  isLoading,
}: {
  count: number;
  isLoading: boolean;
}) {
  return (
    <span
      aria-label={isLoading ? "Loading messages" : `${count} messages shown`}
      className="mail-raised mb-0.5 flex items-baseline gap-1 rounded-[7px] border px-2 py-1 font-mono text-[var(--mail-ink-soft)]"
    >
      <span className="text-[10px] font-semibold tabular-nums">
        <InboxCountValue count={count} isLoading={isLoading} />
      </span>
      <span className="text-[7px] tracking-[0.1em] uppercase">shown</span>
    </span>
  );
}

function InboxCountValue({
  count,
  isLoading,
}: {
  count: number;
  isLoading: boolean;
}) {
  if (isLoading) return "··";
  return count;
}

function getMailboxContextLabel(account: MailAccountView | undefined) {
  if (!account) return "Unified inbox";
  if (account.provider === "gmail") return "Gmail account";
  if (account.provider === "icloud") return "iCloud account";
  return "Microsoft 365 account";
}

function SearchInput() {
  const searchQuery = useMailStore((store) => store.searchQuery);
  const setSearchQuery = useMailStore((store) => store.setSearchQuery);

  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--mail-ink-soft)]" />
      <input
        aria-label="Search mail"
        className="mail-field h-10 w-full rounded-[10px] border pr-10 pl-10 text-sm transition outline-none"
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search mail"
        type="search"
        value={searchQuery}
      />
      <ClearSearchButton query={searchQuery} />
    </div>
  );
}

function ClearSearchButton({ query }: { query: string }) {
  const setSearchQuery = useMailStore((store) => store.setSearchQuery);
  if (!query) return null;

  return (
    <button
      aria-label="Clear search"
      className="mail-icon-button absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full"
      onClick={() => setSearchQuery("")}
      type="button"
    >
      <X className="size-3.5" />
    </button>
  );
}

function MobileAccountFilters() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const { accounts } = useLiveMail();

  return (
    <div className="mail-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
      <MobileAccountChip
        active={accountFilter === "all"}
        label="Unified"
        onClick={() => setAccountFilter("all")}
      />
      {accounts.map((account) => (
        <MobileAccountChip
          accent={account.accent}
          active={accountFilter === account._id}
          key={account._id}
          label={account.label}
          onClick={() => setAccountFilter(account._id)}
        />
      ))}
    </div>
  );
}

function SearchResultsLabel() {
  const searchQuery = useMailStore((store) => store.searchQuery);
  if (!searchQuery) return null;
  return (
    <p className="mail-label mt-3 font-mono text-[9px] tracking-[0.12em] uppercase">
      Search results
    </p>
  );
}

function MobileBrand() {
  return (
    <img
      alt="Rodge Mail"
      className="size-6 rounded-[7px] border border-[var(--mail-brass-deep)] shadow-[var(--mail-shadow-raised)] md:hidden"
      src="/icon-192.png"
    />
  );
}

function MobileAccountChip({
  accent,
  active,
  label,
  onClick,
}: {
  accent?: string;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
        active
          ? "border-[var(--mail-brass-deep)] bg-[var(--mail-brass)] text-[#21190a] shadow-[var(--mail-shadow-raised)]"
          : "border-[var(--mail-seam)] bg-[var(--mail-paper)] text-[var(--mail-ink-soft)] shadow-[var(--mail-shadow-inset)]",
      )}
      onClick={onClick}
      type="button"
    >
      <ChipAccent accent={accent} />
      {label}
    </button>
  );
}

function ChipAccent({ accent }: { accent: string | undefined }) {
  if (!accent) return null;
  return (
    <span className="size-1.5 rounded-full" style={{ background: accent }} />
  );
}
