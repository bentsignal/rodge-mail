import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { ArchiveRestore, ArrowLeft, Loader, Trash2 } from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import * as Dialog from "@rodge-mail/ui-web/dialog";
import { toast } from "@rodge-mail/ui-web/toast";

import { QuickLink } from "~/components/quick-link";
import { formatInboxDate } from "../format";

const PAGE_SIZE = 30;

export function ArchivePage() {
  const archive = usePaginatedQuery(
    api.mail.archiveQueries.listArchive,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const [deleteTarget, setDeleteTarget] = useState<ArchivedThread>();

  return (
    <main className="mail-atmosphere bg-background text-foreground fixed inset-0 z-40 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <QuickLink
          className="mail-raised mb-6 inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--mail-seam)] px-3 text-xs font-semibold"
          to="/"
        >
          <ArrowLeft className="size-3.5" />
          Back to inbox
        </QuickLink>
        <header className="mb-8 border-b border-[var(--mail-seam)] pb-6">
          <p className="mail-label mb-2 font-mono text-[9px] tracking-[0.16em] uppercase">
            Rodge Mail
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-[-0.04em]">
            Archive
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--mail-ink-soft)]">
            Restore a conversation to your inbox or permanently remove Rodge
            Mail’s archived copy. Archived conversations expire after 30 days.
          </p>
        </header>
        <ArchiveList
          archive={archive}
          requestDelete={(thread) => setDeleteTarget(thread)}
        />
      </div>
      <PermanentDeleteDialog
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
        }}
        thread={deleteTarget}
      />
    </main>
  );
}

function ArchiveList({
  archive,
  requestDelete,
}: {
  archive: ArchiveQuery;
  requestDelete: (thread: ArchivedThread) => void;
}) {
  if (archive.status === "LoadingFirstPage") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader aria-label="Loading archive" className="size-5 animate-spin" />
      </div>
    );
  }
  if (archive.results.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <h2 className="font-serif text-2xl font-semibold">Archive is empty</h2>
        <p className="mt-2 text-sm text-[var(--mail-ink-soft)]">
          Conversations you archive will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-[var(--mail-seam)] border-y border-[var(--mail-seam)]">
      {archive.results.map((thread) => (
        <ArchivedThreadRow
          key={thread.threadId}
          requestDelete={() => requestDelete(thread)}
          thread={thread}
        />
      ))}
      <ArchiveLoadMore archive={archive} />
    </div>
  );
}

function ArchiveLoadMore({ archive }: { archive: ArchiveQuery }) {
  if (archive.status !== "CanLoadMore") return null;
  return (
    <button
      className="mail-raised hover:text-foreground mx-auto flex h-10 items-center rounded-lg border border-[var(--mail-seam)] px-4 text-xs font-semibold text-[var(--mail-ink-soft)]"
      onClick={() => archive.loadMore(PAGE_SIZE)}
      type="button"
    >
      Load more
    </button>
  );
}

function ArchivedThreadRow({
  requestDelete,
  thread,
}: {
  requestDelete: () => void;
  thread: ArchivedThread;
}) {
  const restore = useMutation(api.mail.archiveMutations.restoreArchivedThread);
  const [isRestoring, setIsRestoring] = useState(false);

  async function restoreThread() {
    setIsRestoring(true);
    try {
      await restore({ threadId: thread.threadId });
      toast.success("Conversation restored to the inbox.");
    } catch {
      toast.error("Could not restore the conversation.");
    }
    setIsRestoring(false);
  }

  return (
    <article className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <p className="truncate text-sm font-semibold">
            {thread.from.name ?? thread.from.address}
          </p>
          <time className="mail-label shrink-0 font-mono text-[9px]">
            {formatInboxDate(new Date(thread.archivedAt).toISOString())}
          </time>
        </div>
        <h2 className="mt-1 truncate font-serif text-lg font-semibold">
          {thread.subject || "(no subject)"}
        </h2>
        <p className="mail-label mt-1 line-clamp-2 text-xs leading-5">
          {thread.snippet}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          className="mail-raised flex h-10 items-center gap-2 rounded-lg border border-[var(--mail-seam)] px-3 text-xs font-semibold disabled:opacity-50"
          disabled={isRestoring}
          onClick={() => void restoreThread()}
          type="button"
        >
          <RestoreIcon isRestoring={isRestoring} />
          Restore
        </button>
        <button
          className="flex h-10 items-center gap-2 rounded-lg border border-[var(--mail-highlight)]/40 px-3 text-xs font-semibold text-[var(--mail-highlight)] hover:bg-[var(--mail-highlight)]/10"
          onClick={requestDelete}
          type="button"
        >
          <Trash2 className="size-3.5" />
          Delete
        </button>
      </div>
    </article>
  );
}

function RestoreIcon({ isRestoring }: { isRestoring: boolean }) {
  if (isRestoring) return <Loader className="size-3.5 animate-spin" />;
  return <ArchiveRestore className="size-3.5" />;
}

function PermanentDeleteDialog({
  onOpenChange,
  thread,
}: {
  onOpenChange: (open: boolean) => void;
  thread: ArchivedThread | undefined;
}) {
  const permanentlyDelete = useMutation(
    api.mail.archiveMutations.permanentlyDeleteArchivedThread,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDelete() {
    if (!thread) return;
    setIsDeleting(true);
    try {
      await permanentlyDelete({ threadId: thread.threadId });
      toast.success("Archived conversation permanently deleted.");
      onOpenChange(false);
    } catch {
      toast.error("Could not delete the archived conversation.");
    }
    setIsDeleting(false);
  }

  return (
    <Dialog.Container onOpenChange={onOpenChange} open={thread !== undefined}>
      <Dialog.Content className="mail-dialog mail-workspace max-w-md overflow-hidden rounded-[18px] border p-0">
        <div className="mail-chassis border-b p-6">
          <Dialog.Title className="font-serif text-2xl tracking-[-0.03em]">
            Delete permanently?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-5 text-[var(--mail-chassis-foreground)]/70">
            This permanently removes Rodge Mail’s archived copy and cannot be
            undone. Your provider copy is unchanged.
          </Dialog.Description>
        </div>
        <div className="flex justify-end gap-2 p-5">
          <button
            className="mail-raised h-10 rounded-lg border border-[var(--mail-seam)] px-4 text-xs font-semibold"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-lg bg-[var(--mail-highlight)] px-4 text-xs font-bold text-white disabled:opacity-50"
            disabled={isDeleting}
            onClick={() => void confirmDelete()}
            type="button"
          >
            <DeleteButtonLabel isDeleting={isDeleting} />
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Container>
  );
}

function DeleteButtonLabel({ isDeleting }: { isDeleting: boolean }) {
  if (isDeleting) return <>Deleting…</>;
  return <>Delete permanently</>;
}

type ArchivedThread = FunctionReturnType<
  typeof api.mail.archiveQueries.listArchive
>["page"][number];
interface ArchiveQuery {
  loadMore: (numItems: number) => void;
  results: ArchivedThread[];
  status: "CanLoadMore" | "Exhausted" | "LoadingFirstPage" | "LoadingMore";
}
