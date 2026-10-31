import { useNavigate } from "@tanstack/react-router";
import { MailOpen, PenLine, Search, X } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import { useLiveMail } from "../live-data";
import { withUnreadSearch } from "../mail-route-search";
import { useMailStore } from "../store";
import { useMailboxNavigation } from "../use-mailbox-navigation";
import {
  BulkSelectButton,
  BulkSelectionToolbar,
} from "./bulk-selection-toolbar";
import { ThreadList } from "./thread-list";

export function InboxPane() {
  const mobileReaderIsOpen = useMailStore((store) => store.mobileReaderIsOpen);

  return (
    <section
      aria-label="Inbox"
      className={cn(
        "border-border min-w-0 flex-1 flex-col border-r lg:w-[400px] lg:min-w-[380px] lg:flex-none xl:w-[420px] xl:min-w-[420px]",
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
  const { mailMode } = useLiveMail();

  return (
    <header className="bg-background border-border shrink-0 border-b px-4 pt-5 pb-4 sm:px-5">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <MobileBrand />
            <h1 className="text-[32px] leading-none font-semibold tracking-[-0.04em] sm:text-[34px]">
              {getMailboxTitle(mailMode)}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MailboxFilterControl mailMode={mailMode} />
          <BulkSelectButton />
          <button
            aria-label="New message"
            className="mail-primary-button flex size-10 items-center justify-center rounded-[10px] transition-colors md:hidden"
            onClick={openComposer}
            type="button"
          >
            <PenLine className="size-4" />
          </button>
        </div>
      </div>
      <SearchInputSlot mailMode={mailMode} />
      <BulkSelectionToolbar />
      <MobileAccountFilters />
      <SearchResultsLabel />
    </header>
  );
}

function SearchInputSlot({
  mailMode,
}: {
  mailMode: "archive" | "inbox" | "spam";
}) {
  if (mailMode === "spam") return null;
  return <SearchInput />;
}

function getMailboxTitle(mailMode: "archive" | "inbox" | "spam") {
  if (mailMode === "archive") return "Archive";
  if (mailMode === "spam") return "Spam";
  return "Inbox";
}

function MailboxFilterControl({
  mailMode,
}: {
  mailMode: "archive" | "inbox" | "spam";
}) {
  if (mailMode !== "inbox") return null;
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
      to:
        mailMode === "archive"
          ? "/archive"
          : mailMode === "spam"
            ? "/spam"
            : "/",
      search: (previous) => withUnreadSearch(previous, nextUnreadOnly),
    });
  }

  return (
    <button
      aria-pressed={unreadOnly}
      className={cn(
        "focus-visible:outline-ring flex h-9 items-center gap-2 rounded-[9px] border px-3 text-[11px] font-semibold tracking-wide transition-[background-color,border-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2",
        unreadOnly
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:text-foreground border-border text-muted-foreground",
      )}
      onClick={toggleUnread}
      type="button"
    >
      <MailOpen aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
      Unread
    </button>
  );
}

export function SearchInput() {
  const searchQuery = useMailStore((store) => store.searchQuery);
  const setSearchQuery = useMailStore((store) => store.setSearchQuery);

  return (
    <div className="relative">
      <Search className="text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
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
  if (mailMode === "spam") return null;

  return (
    <div className="mail-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
      <MobileAccountChip
        active={accountFilter === "all"}
        label="All Inboxes"
        onClick={() => selectMailbox("all")}
      />
      {accounts.map((account) => (
        <MobileAccountChip
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
  const debouncedSearchQuery = useMailStore(
    (store) => store.debouncedSearchQuery,
  );
  const searchQuery = useMailStore((store) => store.searchQuery);
  const { isSearchingInbox } = useLiveMail();
  if (
    !debouncedSearchQuery ||
    searchQuery.trim() !== debouncedSearchQuery ||
    isSearchingInbox
  ) {
    return null;
  }
  return (
    <p className="mail-label mt-3 text-[11px] font-medium tracking-wide uppercase">
      Search results
    </p>
  );
}

function MobileBrand() {
  return (
    <img
      alt="Rodge Mail"
      className="size-6 rounded-[7px] md:hidden"
      src="/icon-192.png"
    />
  );
}

function MobileAccountChip({
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
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
