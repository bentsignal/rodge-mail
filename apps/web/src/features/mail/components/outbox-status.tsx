import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
// eslint-disable-next-line no-restricted-imports -- Outbox status is a shell-level live query with no route loader and an intentional empty loading state.
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock3,
  LoaderCircle,
  RotateCcw,
  Send,
} from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import { cn } from "@rodge-mail/std/cn";

import { QuickLink } from "~/components/quick-link";
import { useRetryOutbox } from "../use-retry-outbox";

type OutboxItem = FunctionReturnType<
  typeof api.outbox.queries.listRecent
>[number];

export function OutboxStatus() {
  const [isOpen, setIsOpen] = useState(false);
  const isSentPage = useRouterState({
    select: (state) => state.location.pathname.startsWith("/sent"),
  });
  const query = useQuery({
    ...convexQuery(api.outbox.queries.listRecent, {}),
    select: (outboxes) => outboxes,
  });
  const outboxes = query.data ?? [];

  if (isSentPage || query.isPending || outboxes.length === 0) return null;

  return (
    <aside className="fixed right-4 bottom-4 z-40 w-[min(340px,calc(100vw-2rem))] sm:right-6 sm:bottom-6">
      <OutboxPanel
        isOpen={isOpen}
        outboxes={outboxes}
        onNavigate={() => setIsOpen(false)}
      />
      <button
        aria-expanded={isOpen}
        aria-controls="outbox-status-panel"
        className="mail-primary-button ml-auto flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-xs font-bold"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Send className="size-3.5" />
        <span>Outbox</span>
        <OutboxSummary outboxes={outboxes} />
        <ChevronDown className={cn("size-3.5", isOpen && "rotate-180")} />
      </button>
    </aside>
  );
}

function OutboxPanel({
  isOpen,
  onNavigate,
  outboxes,
}: {
  isOpen: boolean;
  onNavigate: () => void;
  outboxes: OutboxItem[];
}) {
  if (!isOpen) return null;
  return (
    <div
      className="bg-background text-popover-foreground absolute right-0 bottom-12 max-h-[min(520px,calc(100dvh-6rem))] w-full overflow-hidden rounded-[14px] border"
      id="outbox-status-panel"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Delivery status</h2>
        <QuickLink
          className="text-muted-foreground hover:text-foreground text-xs font-semibold"
          onClick={onNavigate}
          to="/sent"
        >
          View all sent
        </QuickLink>
      </div>
      <div className="mail-scrollbar max-h-[420px] overflow-y-auto">
        {outboxes.map((outbox) => (
          <OutboxRow key={outbox._id} onNavigate={onNavigate} outbox={outbox} />
        ))}
      </div>
    </div>
  );
}

function OutboxRow({
  onNavigate,
  outbox,
}: {
  onNavigate: () => void;
  outbox: OutboxItem;
}) {
  const retry = useRetryOutbox();

  return (
    <article className="border-border hover:bg-muted relative border-b last:border-b-0">
      <QuickLink
        aria-label={`${outbox.subject.trim() || "(no subject)"}, ${getStatusLabel(outbox.status)}`}
        className="flex items-start gap-3 px-4 py-3"
        onClick={onNavigate}
        params={{ outboxId: outbox._id }}
        to="/sent/$outboxId"
      >
        <StatusIcon status={outbox.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold">
              {outbox.subject.trim() || "(no subject)"}
            </p>
            <time className="text-muted-foreground shrink-0 text-[10px] font-medium">
              {formatStatusTime(outbox)}
            </time>
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-[10px]">
            To {formatRecipients(outbox.to)} · {outbox.account.address}
          </p>
          <div className="mt-2 flex h-7 items-center gap-2">
            <span
              className={cn(
                "text-[10px] font-medium tracking-wide uppercase",
                getStatusTextClass(outbox.status),
              )}
            >
              {getStatusLabel(outbox.status)}
            </span>
          </div>
          <OutboxError error={outbox.error} status={outbox.status} />
        </div>
      </QuickLink>
      <RetryButton onRetry={() => retry(outbox._id)} status={outbox.status} />
    </article>
  );
}

function RetryButton({
  onRetry,
  status,
}: {
  onRetry: () => void;
  status: OutboxItem["status"];
}) {
  if (status !== "failed") return null;
  return (
    <button
      className="text-destructive hover:bg-destructive/8 bg-background absolute top-[46px] right-4 flex h-7 items-center gap-1.5 rounded-full border border-current/20 px-2.5 text-[10px] font-semibold"
      onClick={onRetry}
      type="button"
    >
      <RotateCcw className="size-3" />
      Retry
    </button>
  );
}

function OutboxError({
  error,
  status,
}: {
  error: string | undefined;
  status: OutboxItem["status"];
}) {
  if (status !== "failed" || !error) return null;
  return (
    <p
      className="bg-destructive/8 text-destructive mt-2 rounded-lg px-2.5 py-2 text-[10px] leading-4"
      role="alert"
    >
      {error}
    </p>
  );
}

function OutboxSummary({ outboxes }: { outboxes: OutboxItem[] }) {
  const label = getSummaryLabel(outboxes);
  if (!label) return null;

  const hasFailure = outboxes.some((outbox) => outbox.status === "failed");
  return (
    <span
      aria-live="polite"
      className={cn(
        "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        hasFailure && "bg-destructive/10 text-destructive",
      )}
    >
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: OutboxItem["status"] }) {
  const className = cn(
    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
    getStatusIconClass(status),
  );
  if (status === "sending") {
    return (
      <span className={className}>
        <LoaderCircle className="size-3.5 animate-spin" />
      </span>
    );
  }
  if (status === "sent") {
    return (
      <span className={className}>
        <Check className="size-3.5" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={className}>
        <AlertCircle className="size-3.5" />
      </span>
    );
  }
  return (
    <span className={className}>
      <Clock3 className="size-3.5" />
    </span>
  );
}

function getSummaryLabel(outboxes: OutboxItem[]) {
  const failed = outboxes.filter((outbox) => outbox.status === "failed").length;
  if (failed > 0) return `${failed} failed`;
  const sending = outboxes.filter(
    (outbox) => outbox.status === "sending",
  ).length;
  if (sending > 0) return "Sending";
  const pending = outboxes.filter(
    (outbox) => outbox.status === "pending",
  ).length;
  if (pending > 0) return `${pending} queued`;
  return null;
}

function getStatusLabel(status: OutboxItem["status"]) {
  if (status === "pending") return "Queued";
  if (status === "sending") return "Sending";
  if (status === "failed") return "Failed";
  return "Sent";
}

function getStatusTextClass(status: OutboxItem["status"]) {
  if (status === "failed") return "text-destructive";
  if (status === "sent") return "text-foreground";
  return "text-muted-foreground";
}

function getStatusIconClass(status: OutboxItem["status"]) {
  if (status === "failed") return "bg-destructive/10 text-destructive";
  if (status === "sent") return "bg-muted text-foreground";
  return "bg-muted text-muted-foreground";
}

function formatRecipients(recipients: OutboxItem["to"]) {
  return recipients.map((recipient) => recipient.address).join(", ");
}

function formatStatusTime(outbox: OutboxItem) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(outbox.sentAt ?? outbox.updatedAt));
}
