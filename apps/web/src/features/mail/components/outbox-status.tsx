import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
// eslint-disable-next-line no-restricted-imports -- Outbox status is a shell-level live query with no route loader and an intentional empty loading state.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useMutation } from "convex/react";
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
import { toast } from "@rodge-mail/ui-web/toast";

type OutboxItem = FunctionReturnType<
  typeof api.outbox.queries.listRecent
>[number];

export function OutboxStatus() {
  const [isOpen, setIsOpen] = useState(false);
  const query = useQuery({
    ...convexQuery(api.outbox.queries.listRecent, {}),
    select: (outboxes) => outboxes,
  });
  const outboxes = query.data ?? [];

  if (query.isPending || outboxes.length === 0) return null;

  return (
    <aside className="fixed right-4 bottom-4 z-40 w-[min(340px,calc(100vw-2rem))] sm:right-6 sm:bottom-6">
      <OutboxPanel isOpen={isOpen} outboxes={outboxes} />
      <button
        aria-expanded={isOpen}
        aria-controls="outbox-status-panel"
        className="mail-brass-button ml-auto flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-xs font-bold"
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
  outboxes,
}: {
  isOpen: boolean;
  outboxes: OutboxItem[];
}) {
  if (!isOpen) return null;
  return (
    <div
      className="mail-workspace text-popover-foreground absolute right-0 bottom-12 max-h-[min(520px,calc(100dvh-6rem))] w-full overflow-hidden rounded-[14px] border"
      id="outbox-status-panel"
    >
      <div className="mail-chassis border-b px-4 py-3">
        <h2 className="font-serif text-lg font-semibold">Delivery status</h2>
        <p className="mt-0.5 text-[10px] text-[var(--mail-chassis-foreground)]/70">
          Live delivery state from queue to provider.
        </p>
      </div>
      <div className="mail-scrollbar max-h-[420px] overflow-y-auto">
        {outboxes.map((outbox) => (
          <OutboxRow key={outbox._id} outbox={outbox} />
        ))}
      </div>
    </div>
  );
}

function OutboxRow({ outbox }: { outbox: OutboxItem }) {
  const retryOutbox = useMutation(api.mail.mutations.retryOutbox);
  const [isRetrying, setIsRetrying] = useState(false);

  async function retry() {
    if (isRetrying || outbox.status !== "failed") return;
    setIsRetrying(true);
    try {
      const result = await retryOutbox({ outboxId: outbox._id });
      if (result.retried) toast.success("Retry queued.");
    } catch (error) {
      toast.error(getRetryError(error));
    }
    setIsRetrying(false);
  }

  return (
    <article className="border-border border-b px-4 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <StatusIcon status={outbox.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold">
              {outbox.subject.trim() || "(no subject)"}
            </p>
            <time className="text-muted-foreground shrink-0 font-mono text-[8px]">
              {formatStatusTime(outbox)}
            </time>
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-[10px]">
            To {formatRecipients(outbox.to)} · {outbox.account.address}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                "font-mono text-[8px] tracking-[0.1em] uppercase",
                getStatusTextClass(outbox.status),
              )}
            >
              {getStatusLabel(outbox.status)}
            </span>
            <RetryButton
              isRetrying={isRetrying}
              onRetry={() => void retry()}
              status={outbox.status}
            />
          </div>
          <OutboxError error={outbox.error} status={outbox.status} />
        </div>
      </div>
    </article>
  );
}

function RetryButton({
  isRetrying,
  onRetry,
  status,
}: {
  isRetrying: boolean;
  onRetry: () => void;
  status: OutboxItem["status"];
}) {
  if (status !== "failed") return null;
  return (
    <button
      className="text-destructive hover:bg-destructive/8 ml-auto flex h-7 items-center gap-1.5 rounded-full border border-current/20 px-2.5 text-[10px] font-semibold disabled:opacity-50"
      disabled={isRetrying}
      onClick={onRetry}
      type="button"
    >
      <RotateCcw className={cn("size-3", isRetrying && "animate-spin")} />
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
        "bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[8px] tracking-[0.08em] uppercase",
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
  if (status === "sent") return "text-secondary";
  return "text-muted-foreground";
}

function getStatusIconClass(status: OutboxItem["status"]) {
  if (status === "failed") return "bg-destructive/10 text-destructive";
  if (status === "sent") return "bg-secondary/10 text-secondary";
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

function getRetryError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not retry this message.";
}
