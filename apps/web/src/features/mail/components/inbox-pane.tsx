import { PenLine, Search, X } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

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
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <MobileBrand />
            <p className="font-mono text-[9px] tracking-[0.18em] text-[#8c8174] uppercase">
              {currentAccount?.label ?? "All accounts"}
            </p>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <h1 className="font-serif text-[28px] leading-none font-semibold tracking-[-0.035em] sm:text-[31px]">
              Inbox
            </h1>
            <span className="font-mono text-[10px] text-[#9b8e80] tabular-nums">
              <InboxCount
                count={inboxMessages.length}
                isLoading={isLoadingInbox}
              />
            </span>
          </div>
        </div>
        <button
          aria-label="Compose message"
          className="flex size-10 items-center justify-center rounded-full bg-[#20251f] text-[#f8f1e6] shadow-md transition hover:-translate-y-0.5 hover:bg-[#30362f] md:hidden"
          onClick={openComposer}
          type="button"
        >
          <PenLine className="size-4" />
        </button>
      </div>
      <SearchInput />
      <MobileAccountFilters />
      <CategoryTabs />
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
  if (isLoading) return "··";
  return count.toString().padStart(2, "0");
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

function CategoryTabs() {
  const category = useMailStore((store) => store.category);
  const searchQuery = useMailStore((store) => store.searchQuery);
  const setCategory = useMailStore((store) => store.setCategory);
  const setSearchQuery = useMailStore((store) => store.setSearchQuery);

  function chooseCategory(nextCategory: "focused" | "other") {
    setSearchQuery("");
    setCategory(nextCategory);
  }

  return (
    <div className="mt-3.5 flex items-center gap-1 border-b border-[#ded5c8] dark:border-[#3c403a]">
      <CategoryButton
        active={category === "focused" && searchQuery.length === 0}
        label="Focused"
        onClick={() => chooseCategory("focused")}
      />
      <CategoryButton
        active={category === "other" && searchQuery.length === 0}
        label="Other"
        onClick={() => chooseCategory("other")}
      />
      <SearchResultsLabel query={searchQuery} />
    </div>
  );
}

function MobileBrand() {
  return (
    <span className="flex size-6 items-center justify-center rounded-lg bg-[#20251f] font-serif text-xs text-white italic md:hidden">
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
          ? "border-[#2a3029] bg-[#2a3029] text-white"
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

function CategoryButton({
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
      className={cn(
        "relative px-3 pb-2 text-[13px] font-semibold transition",
        active ? "text-foreground" : "hover:text-foreground text-[#94887a]",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
      <CategoryMarker active={active} />
    </button>
  );
}

function CategoryMarker({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="absolute right-3 bottom-[-1px] left-3 h-0.5 rounded-full bg-[#c76749]" />
  );
}

function SearchResultsLabel({ query }: { query: string }) {
  if (!query) return null;
  return (
    <p className="ml-auto pb-2 font-mono text-[9px] tracking-[0.12em] text-[#8e8377] uppercase">
      Search results
    </p>
  );
}
