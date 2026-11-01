import type { LucideIcon } from "lucide-react";
import { Archive, Inbox, Mails, Send, ShieldAlert } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { MailMode } from "../live-data-types";
import { QuickLink } from "~/components/quick-link";
import { toMailboxLinkSearch } from "../mail-route-search";
import { getAccountButtonLabel } from "./account-rail-presentation";

export const MAILBOXES = [
  { icon: Inbox, label: "Inbox", mode: "inbox", to: "/" },
  { icon: Mails, label: "All Mail", mode: "all", to: "/all" },
  { icon: Send, label: "Sent", mode: "sent", to: "/sent" },
  { icon: Archive, label: "Archive", mode: "archive", to: "/archive" },
  { icon: ShieldAlert, label: "Spam", mode: "spam", to: "/spam" },
] as const satisfies readonly {
  icon: LucideIcon;
  label: string;
  mode: MailMode;
  to: string;
}[];

export function MailboxLink({
  active,
  count,
  icon: Icon,
  label,
  onClick,
  to,
}: {
  active: boolean;
  count?: number;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  to: (typeof MAILBOXES)[number]["to"];
}) {
  return (
    <QuickLink
      aria-label={getAccountButtonLabel(label, count)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-sm transition-colors xl:justify-start",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
      onClick={onClick}
      search={toMailboxLinkSearch}
      to={to}
    >
      <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.7} />
      <span className="hidden truncate xl:block">{label}</span>
      <UnreadCount active={active} count={count} />
    </QuickLink>
  );
}

export function UnreadCount({
  active,
  count,
}: {
  active: boolean;
  count: number | undefined;
}) {
  if (!count) return null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-medium tabular-nums xl:static xl:ml-auto xl:min-w-5 xl:px-1.5 xl:text-[11px]",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-sidebar-accent text-muted-foreground",
      )}
    >
      {count}
    </span>
  );
}

export function Brand() {
  return (
    <div className="flex min-h-10 items-center justify-center gap-3 xl:justify-start xl:px-1">
      <img
        alt="Rodge Mail"
        className="size-10 shrink-0 rounded-[10px]"
        src="/icon-192.png"
      />
      <div className="hidden min-w-0 xl:block">
        <p className="text-foreground text-[16px] leading-5 font-semibold tracking-[-0.02em] whitespace-nowrap">
          Rodge Mail
        </p>
      </div>
    </div>
  );
}
