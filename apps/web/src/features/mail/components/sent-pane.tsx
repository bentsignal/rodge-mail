import type { FunctionReturnType } from "convex/server";
// eslint-disable-next-line no-restricted-imports -- The outbox is a small live query beside the paginated sent list.
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { usePaginatedQuery } from "convex/react";
import { Paperclip, Send } from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import {
  formatSentRecipients,
  getSentStatusLabel,
  getSentSubject,
} from "@rodge-mail/features/mail";
import { cn } from "@rodge-mail/std/cn";

import { QuickLink } from "~/components/quick-link";
import { MAIL_PAGE_SIZE } from "../constants";
import { formatInboxDate, getInitials } from "../format";
import { useSelectedOutboxId } from "../sent-live-data";
import { RetryOutboxButton } from "./sent-message-pane";

export type SentRow = FunctionReturnType<
  typeof api.outbox.queries.listUnsent
>[number];

export function SentPane() {
  const outboxId = useSelectedOutboxId();
  const unsent = useQuery({
    ...convexQuery(api.outbox.queries.listUnsent, {}),
    select: (rows) => rows,
  });
  const sent = usePaginatedQuery(
    api.outbox.queries.listSent,
    {},
    { initialNumItems: MAIL_PAGE_SIZE },
  );

  return (
    <section
      aria-label="Sent"
      className={cn(
        "border-border min-w-0 flex-1 flex-col border-r lg:w-[400px] lg:min-w-[380px] lg:flex-none xl:w-[420px] xl:min-w-[420px]",
        outboxId ? "hidden lg:flex" : "flex",
      )}
    >
      <header className="bg-background border-border shrink-0 border-b px-4 pt-5 pb-4 sm:px-5">
        <h1 className="text-[32px] leading-none font-semibold tracking-[-0.04em] sm:text-[34px]">
          Sent
        </h1>
      </header>
      <div className="mail-scrollbar min-h-0 flex-1 overflow-y-auto">
        <SentSection
          rows={unsent.data ?? []}
          selectedId={outboxId}
          title="Outbox"
        />
        <SentSection
          rows={sent.results}
          selectedId={outboxId}
          title={unsent.data?.length ? "Sent" : undefined}
        />
        <SentListFooter
          canLoadMore={sent.status === "CanLoadMore"}
          isEmpty={
            sent.status === "Exhausted" &&
            sent.results.length === 0 &&
            (unsent.data?.length ?? 0) === 0
          }
          isLoading={sent.status === "LoadingFirstPage"}
          onLoadMore={() => sent.loadMore(MAIL_PAGE_SIZE)}
        />
      </div>
    </section>
  );
}

function SentSection({
  rows,
  selectedId,
  title,
}: {
  rows: SentRow[];
  selectedId: string | undefined;
  title: string | undefined;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      {title ? (
        <h2 className="mail-label bg-muted/60 border-border border-b px-5 py-2 text-[11px] font-medium tracking-wide uppercase">
          {title}
        </h2>
      ) : null}
      {rows.map((row) => (
        <SentListRow
          key={row._id}
          row={row}
          selected={row._id === selectedId}
        />
      ))}
    </div>
  );
}

function SentListRow({ row, selected }: { row: SentRow; selected: boolean }) {
  const recipients = formatSentRecipients(row.to);
  return (
    <article
      className={cn(
        "group border-border bg-background relative border-b transition-colors",
        selected ? "bg-accent" : "hover:bg-muted",
      )}
    >
      <QuickLink
        aria-current={selected ? "page" : undefined}
        aria-label={`To ${recipients}, ${getSentSubject(row.subject)}, ${getSentStatusLabel(row.status)}`}
        className="block px-4 py-3.5 sm:px-5"
        params={{ outboxId: row._id }}
        to="/sent/$outboxId"
      >
        <div className="flex min-h-[76px] items-center gap-3">
          <div className="border-border bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-[10px] border text-[11px] font-semibold">
            {getInitials(recipients)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-foreground min-w-0 flex-1 truncate text-[13px] font-semibold">
                <span className="mail-label font-medium">To </span>
                {recipients}
              </p>
              <AttachmentMarker count={row.attachmentCount} />
              <time className="mail-label shrink-0 text-[11px] font-medium tabular-nums">
                {formatInboxDate(
                  new Date(row.sentAt ?? row.createdAt).toISOString(),
                )}
              </time>
            </div>
            <p className="text-foreground/90 mt-0.5 truncate text-[16px] leading-5 tracking-[-0.01em]">
              {getSentSubject(row.subject)}
            </p>
            <p
              className={cn(
                "mail-label mt-0.5 line-clamp-2 text-[12px] leading-[1.45]",
                row.status === "failed" && "pr-20",
              )}
            >
              {row.snippet}
            </p>
            <SentRowStatus status={row.status} />
          </div>
        </div>
      </QuickLink>
      {row.status === "failed" ? (
        <div className="absolute right-4 bottom-3 sm:right-5">
          <RetryOutboxButton outboxId={row._id} />
        </div>
      ) : null}
    </article>
  );
}

function SentRowStatus({ status }: { status: SentRow["status"] }) {
  if (status === "sent") return null;
  return (
    <p
      className={cn(
        "mt-1.5 text-[10px] font-semibold tracking-wide uppercase",
        status === "failed" ? "text-destructive" : "mail-label",
      )}
    >
      {getSentStatusLabel(status)}
    </p>
  );
}

function AttachmentMarker({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Paperclip
      aria-label={`${count} attachment${count === 1 ? "" : "s"}`}
      className="text-muted-foreground size-3 shrink-0"
    />
  );
}

function SentListFooter({
  canLoadMore,
  isEmpty,
  isLoading,
  onLoadMore,
}: {
  canLoadMore: boolean;
  isEmpty: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  if (isLoading) {
    return (
      <div aria-label="Loading sent mail" className="space-y-3 p-5">
        {[0, 1, 2].map((index) => (
          <div className="bg-muted h-16 animate-pulse rounded-lg" key={index} />
        ))}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="mail-label flex flex-col items-center px-8 py-16 text-center">
        <Send className="mb-4 size-5" strokeWidth={1.5} />
        <p className="text-foreground text-base font-semibold">
          No sent mail yet
        </p>
      </div>
    );
  }
  if (!canLoadMore) return null;
  return (
    <button
      className="text-muted-foreground hover:text-foreground w-full py-4 text-xs font-semibold"
      onClick={onLoadMore}
      type="button"
    >
      Load more
    </button>
  );
}
