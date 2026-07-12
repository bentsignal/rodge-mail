import { PenLine, Search, X } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import { useMailboxNavigation } from "../use-mailbox-navigation";
import { ThreadList } from "./thread-list";

export function InboxPane() {
  const mobileReaderIsOpen = useMailStore((store) => store.mobileReaderIsOpen);

  return (
    <section
      aria-label="Inbox"
      className={cn(
        "min-w-0 flex-1 flex-col border-r border-[var(--mail-seam)] bg-[var(--mail-paper-soft)] lg:w-[360px] lg:min-w-[340px] lg:flex-none xl:w-[385px] xl:min-w-[385px]",
        mobileReaderIsOpen ? "hidden lg:flex" : "flex",
      )}
    >
      <InboxHeader />
      <ThreadList />
    </section>
  );
}

function InboxHeader() {
  const openComposer = useMailStore((store) => store.openComposer);
  const { inboxMessages, isLoadingInbox } = useLiveMail();

  return (
    <header className="mail-paper shrink-0 border-b border-[var(--mail-seam)] px-4 pt-5 pb-4 shadow-[0_2px_6px_rgba(55,40,19,0.08)] sm:px-5 dark:shadow-[0_2px_8px_rgba(0,0,0,0.22)]">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <MobileBrand />
            <h1 className="font-serif text-[32px] leading-none font-semibold tracking-[-0.04em] sm:text-[34px]">
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
      aria-label={isLoading ? "Loading messages" : `${count} messages`}
      className="mail-raised mb-0.5 flex min-w-8 items-center justify-center rounded-[7px] border px-2 py-1 font-mono text-xs font-semibold text-[var(--mail-ink-soft)] tabular-nums"
    >
      <InboxCountValue count={count} isLoading={isLoading} />
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

function SearchInput() {
  const searchQuery = useMailStore((store) => store.searchQuery);
  const setSearchQuery = useMailStore((store) => store.setSearchQuery);

  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--mail-ink-soft)]" />
      <input
        aria-label="Search mail"
        className="mail-field h-11 w-full rounded-lg border pr-11 pl-10 text-sm transition outline-none"
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
      className="mail-icon-button absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg"
      onClick={() => setSearchQuery("")}
      type="button"
    >
      <X className="size-3.5" />
    </button>
  );
}

function MobileAccountFilters() {
  const accountFilter = useMailStore((store) => store.accountFilter);
  const selectMailbox = useMailboxNavigation();
  const { accounts } = useLiveMail();

  return (
    <div className="mail-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
      <MobileAccountChip
        active={accountFilter === "all"}
        label="Unified"
        onClick={() => selectMailbox("all")}
      />
      {accounts.map((account) => (
        <MobileAccountChip
          accent={account.accent}
          active={accountFilter === account._id}
          key={account._id}
          label={account.label}
          onClick={() => selectMailbox(account._id)}
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
