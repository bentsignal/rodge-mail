import { useNavigate } from "@tanstack/react-router";
import { MailOpen, PenLine, Search, X } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import { useLiveMail } from "../live-data";
import { withUnreadSearch } from "../mail-route-search";
import { useMailStore } from "../store";
import { useMailboxNavigation } from "../use-mailbox-navigation";
import { ThreadList } from "./thread-list";

export function InboxPane() {
  const mobileReaderIsOpen = useMailStore((store) => store.mobileReaderIsOpen);

  return (
    <section
      aria-label="Inbox"
      className={cn(
        "mail-inbox-pane min-w-0 flex-1 flex-col border-r border-[var(--mail-seam)] lg:w-[400px] lg:min-w-[380px] lg:flex-none xl:w-[420px] xl:min-w-[420px]",
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
  const { inboxMessages, isLoadingInbox, mailMode } = useLiveMail();

  return (
    <header className="mail-paper shrink-0 border-b border-[var(--mail-seam)] px-4 pt-5 pb-4 shadow-[0_2px_6px_rgba(55,40,19,0.08)] sm:px-5 dark:shadow-[0_2px_8px_rgba(0,0,0,0.22)]">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <MobileBrand />
            <h1 className="font-serif text-[32px] leading-none font-semibold tracking-[-0.04em] sm:text-[34px]">
              {getMailboxTitle(mailMode)}
            </h1>
            <InboxCount
              count={inboxMessages.length}
              isLoading={isLoadingInbox}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MailboxFilterControl mailMode={mailMode} />
          <button
            aria-label="New message"
            className="mail-brass-button flex size-10 items-center justify-center rounded-[10px] transition-colors md:hidden"
            onClick={openComposer}
            type="button"
          >
            <PenLine className="size-4" />
          </button>
        </div>
      </div>
      <SearchInput />
      <MobileAccountFilters />
      <SearchResultsLabel />
    </header>
  );
}

function getMailboxTitle(mailMode: "archive" | "inbox") {
  if (mailMode === "archive") return "Archive";
  return "Inbox";
}

function MailboxFilterControl({ mailMode }: { mailMode: "archive" | "inbox" }) {
  if (mailMode === "archive") return null;
  return <UnreadFilterButton />;
}

function UnreadFilterButton() {
  const navigate = useNavigate();
  const setUnreadOnly = useMailStore((store) => store.setUnreadOnly);
  const unreadOnly = useMailStore((store) => store.unreadOnly);
  const { mailMode } = useLiveMail();

  function toggleUnread() {
    const nextUnreadOnly = !unreadOnly;
    setUnreadOnly(nextUnreadOnly);
    void navigate({
      to: mailMode === "archive" ? "/archive" : "/",
      search: (previous) => withUnreadSearch(previous, nextUnreadOnly),
    });
  }

  return (
    <button
      aria-pressed={unreadOnly}
      className={cn(
        "flex h-9 items-center gap-2 rounded-[9px] border px-3 font-mono text-[10px] font-semibold tracking-[0.04em] transition-[background-color,border-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mail-brass-deep)]",
        unreadOnly
          ? "border-[var(--mail-brass-deep)] bg-[var(--mail-brass)] text-[#21190a] shadow-[var(--mail-shadow-raised)]"
          : "mail-raised hover:text-foreground border-[var(--mail-seam)] text-[var(--mail-ink-soft)]",
      )}
      onClick={toggleUnread}
      type="button"
    >
      <MailOpen aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
      Unread
    </button>
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

export function SearchInput() {
  const searchQuery = useMailStore((store) => store.searchQuery);
  const setSearchQuery = useMailStore((store) => store.setSearchQuery);

  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--mail-ink-soft)]" />
      <input
        aria-label="Search mail"
        autoComplete="off"
        className="mail-field h-11 w-full rounded-lg border pr-11 pl-10 text-sm transition outline-none"
        inputMode="search"
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search mail"
        role="searchbox"
        type="text"
        value={searchQuery}
      />
      <ClearSearchButton query={searchQuery} />
    </div>
  );
}

export function ClearSearchButton({ query }: { query: string }) {
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
  const { accounts, mailMode } = useLiveMail();
  const selectMailbox = useMailboxNavigation(
    mailMode === "archive" ? "/archive" : "/",
  );

  return (
    <div className="mail-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
      <MobileAccountChip
        active={accountFilter === "all"}
        label="All Inboxes"
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
