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
        "border-border/70 min-w-0 flex-1 flex-col border-r lg:max-w-[430px] lg:min-w-[360px] lg:flex-none xl:max-w-[460px]",
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
    <header className="border-border/70 bg-card/80 shrink-0 border-b px-4 pt-4 pb-3.5 sm:px-5 sm:pt-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <MobileBrand />
            <p className="font-mono text-[9px] tracking-[0.18em] text-[#8c8174] uppercase">
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
          className="flex size-10 items-center justify-center rounded-full bg-[var(--mail-brand)] text-[var(--mail-brand-foreground)] shadow-md transition-colors hover:bg-[var(--mail-brand-hover)] md:hidden"
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
      className="mb-0.5 flex items-baseline gap-1 rounded-full bg-[#e9e1d5] px-2 py-1 font-mono text-[#8e8174] dark:bg-white/[0.05] dark:text-[#aaa095]"
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
      <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#8e8377]" />
      <input
        aria-label="Search mail"
        className="border-border/70 bg-background/70 h-10 w-full rounded-xl border pr-10 pl-10 text-sm transition outline-none placeholder:text-[#9b9288] focus:border-[#ba6b4f]/55 focus:ring-3 focus:ring-[#ba6b4f]/10"
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search people, subjects, or messages"
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
      className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[#8e8377] hover:bg-black/[0.05]"
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
    <p className="mt-3 font-mono text-[9px] tracking-[0.12em] text-[#8e8377] uppercase">
      Search results
    </p>
  );
}

function MobileBrand() {
  return (
    <span className="flex size-6 items-center justify-center rounded-lg bg-[var(--mail-brand)] font-serif text-xs text-[var(--mail-brand-foreground)] italic md:hidden">
      R
    </span>
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
          ? "border-[var(--mail-brand)] bg-[var(--mail-brand)] text-[var(--mail-brand-foreground)]"
          : "border-border bg-background/50 text-muted-foreground",
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
