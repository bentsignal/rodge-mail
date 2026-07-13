import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  CheckCheck,
  ListChecks,
  MailOpen,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import type { InboxMessage } from "../types";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";

export function BulkSelectButton() {
  const bulkSelectionIsActive = useMailStore(
    (store) => store.bulkSelectionIsActive,
  );
  const setBulkSelectionActive = useMailStore(
    (store) => store.setBulkSelectionActive,
  );
  return (
    <button
      aria-pressed={bulkSelectionIsActive}
      className={getSelectButtonClass(bulkSelectionIsActive)}
      onClick={() => setBulkSelectionActive(!bulkSelectionIsActive)}
      type="button"
    >
      <ListChecks aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
      {getSelectButtonLabel(bulkSelectionIsActive)}
    </button>
  );
}

export function BulkSelectionToolbar() {
  const bulkSelectionIsActive = useMailStore(
    (store) => store.bulkSelectionIsActive,
  );
  if (!bulkSelectionIsActive) return null;
  return <ActiveBulkSelectionToolbar />;
}

function ActiveBulkSelectionToolbar() {
  const [isActing, setIsActing] = useState(false);
  const bulkSelectedThreadIds = useMailStore(
    (store) => store.bulkSelectedThreadIds,
  );
  const liveMail = useLiveMail();
  const selectedMessages = liveMail.inboxMessages.filter((message) =>
    bulkSelectedThreadIds.has(message.threadId),
  );

  async function run(action: () => Promise<void>) {
    setIsActing(true);
    await action();
    setIsActing(false);
  }

  return (
    <div
      aria-label="Bulk actions"
      className="mt-3 flex min-h-9 items-center gap-1.5 overflow-x-auto"
      role="toolbar"
    >
      <span className="mail-label mr-auto shrink-0 font-mono text-[9px] tracking-[0.1em] uppercase">
        {selectedMessages.length} selected
      </span>
      <BulkMailboxActions
        disabled={selectedMessages.length === 0 || isActing}
        liveMail={liveMail}
        messages={selectedMessages}
        run={run}
      />
    </div>
  );
}

function BulkMailboxActions({
  disabled,
  liveMail,
  messages,
  run,
}: {
  disabled: boolean;
  liveMail: ReturnType<typeof useLiveMail>;
  messages: InboxMessage[];
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  if (liveMail.mailMode === "archive") {
    return (
      <ArchiveBulkActions
        disabled={disabled}
        liveMail={liveMail}
        messages={messages}
        run={run}
      />
    );
  }
  return (
    <InboxBulkActions
      disabled={disabled}
      liveMail={liveMail}
      messages={messages}
      run={run}
    />
  );
}

function ArchiveBulkActions({
  disabled,
  liveMail,
  messages,
  run,
}: BulkActionsProps) {
  async function permanentlyDelete() {
    if (!confirmPermanentDelete(messages.length)) return;
    await run(async () =>
      await liveMail.permanentlyDeleteArchivedThreads(messages),
    );
  }
  return (
    <>
      <BulkActionButton
        disabled={disabled}
        icon={RotateCcw}
        label="Restore"
        onClick={() =>
          void run(async () =>
            await liveMail.restoreArchivedThreads(messages),
          )
        }
      />
      <BulkActionButton
        destructive={true}
        disabled={disabled}
        icon={Trash2}
        label="Delete"
        onClick={() => void permanentlyDelete()}
      />
    </>
  );
}

function InboxBulkActions({
  disabled,
  liveMail,
  messages,
  run,
}: BulkActionsProps) {
  return (
    <>
      <BulkActionButton
        disabled={disabled}
        icon={Archive}
        label="Archive"
        onClick={() =>
          void run(async () => await liveMail.archiveThreads(messages))
        }
      />
      <BulkActionButton
        disabled={disabled}
        icon={CheckCheck}
        label="Read"
        onClick={() =>
          void run(async () => await liveMail.setThreadsRead(messages, true))
        }
      />
      <BulkActionButton
        disabled={disabled}
        icon={MailOpen}
        label="Unread"
        onClick={() =>
          void run(async () => await liveMail.setThreadsRead(messages, false))
        }
      />
    </>
  );
}

interface BulkActionsProps {
  disabled: boolean;
  liveMail: ReturnType<typeof useLiveMail>;
  messages: InboxMessage[];
  run: (action: () => Promise<void>) => Promise<void>;
}

function BulkActionButton({
  destructive = false,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  destructive?: boolean;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={getBulkActionButtonClass(destructive)}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  );
}

function confirmPermanentDelete(count: number) {
  return window.confirm(
    `Permanently delete ${count} archived conversation${count === 1 ? "" : "s"}? This cannot be undone.`,
  );
}

function getSelectButtonLabel(isActive: boolean) {
  return isActive ? "Done" : "Select";
}

function getSelectButtonClass(isActive: boolean) {
  return cn(
    "flex h-9 items-center gap-2 rounded-[9px] border px-3 font-mono text-[10px] font-semibold tracking-[0.04em] transition-[background-color,border-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mail-brass-deep)]",
    isActive
      ? "border-[var(--mail-brass-deep)] bg-[var(--mail-brass)] text-[#21190a] shadow-[var(--mail-shadow-raised)]"
      : "mail-raised hover:text-foreground border-[var(--mail-seam)] text-[var(--mail-ink-soft)]",
  );
}

function getBulkActionButtonClass(destructive: boolean) {
  return cn(
    "mail-raised flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-[var(--mail-seam)] px-2.5 font-mono text-[9px] font-semibold tracking-[0.04em] disabled:cursor-not-allowed disabled:opacity-40",
    destructive
      ? "text-[var(--mail-highlight)]"
      : "text-[var(--mail-ink-soft)] hover:text-foreground",
  );
}
