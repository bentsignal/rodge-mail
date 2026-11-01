import type { LucideIcon } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import { QuickLink } from "~/components/quick-link";

export function MailboxLink({
  active,
  icon: Icon,
  label,
  onClick,
  to,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  to: "/all" | "/archive" | "/sent" | "/spam";
}) {
  return (
    <QuickLink
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-sm transition-colors xl:justify-start",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
      onClick={onClick}
      to={to}
    >
      <Icon className="size-[18px]" strokeWidth={1.7} />
      <span className="hidden truncate xl:block">{label}</span>
    </QuickLink>
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
