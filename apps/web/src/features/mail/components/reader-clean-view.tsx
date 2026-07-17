import { useMutation } from "convex/react";
import { LoaderCircle, ShieldAlert, Sparkles } from "lucide-react";

import { api } from "@rodge-mail/convex/api";

import type { ThreadMessageDetail } from "../types";

export function MessageOverview({ message }: { message: ThreadMessageDetail }) {
  const classification = message.classification;
  const cleanView = message.cleanView;
  const isPreparing =
    cleanView?.status === "pending" || cleanView?.status === "running";
  const hasCleanView = hasGeneratedCleanView(cleanView);
  const summary = getOverviewSummary(cleanView?.summary, isPreparing);
  const label = classification?.isSpam ? "Likely spam" : "Overview";
  return (
    <aside className="mail-inset mt-6 rounded-[13px] border px-4 py-3.5 sm:ml-[52px]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--mail-brass)_18%,transparent)] text-[var(--mail-brass-bright)]">
          <OverviewIcon
            isPreparing={isPreparing}
            isSpam={classification?.isSpam === true}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mail-label font-mono text-[8px] tracking-[0.16em] uppercase">
            {label}
          </p>
          <p className="mt-1 text-sm leading-5.5 text-[var(--mail-ink-soft)]">
            {summary}
          </p>
          <CleanViewError cleanView={cleanView} />
          <CleanViewAction
            hasCleanView={hasCleanView}
            isPreparing={isPreparing}
            messageId={message._id}
          />
        </div>
      </div>
    </aside>
  );
}

function CleanViewError({
  cleanView,
}: {
  cleanView: ThreadMessageDetail["cleanView"];
}) {
  if (cleanView?.status !== "failed" || !cleanView.error) return null;
  return (
    <p className="mt-2 text-xs leading-5 text-[var(--mail-rust)]">
      {formatCleanViewError(cleanView.error)}
    </p>
  );
}

function CleanViewAction({
  hasCleanView,
  isPreparing,
  messageId,
}: {
  hasCleanView: boolean;
  isPreparing: boolean;
  messageId: ThreadMessageDetail["_id"];
}) {
  if (hasCleanView) return null;
  return (
    <GenerateCleanViewButton isPreparing={isPreparing} messageId={messageId} />
  );
}

function GenerateCleanViewButton({
  isPreparing,
  messageId,
}: {
  isPreparing: boolean;
  messageId: ThreadMessageDetail["_id"];
}) {
  const generate = useMutation(api.cleanView.mutations.generate);
  return (
    <button
      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--mail-seam)] bg-[var(--mail-paper)] px-2.5 font-mono text-[9px] font-semibold tracking-[0.08em] text-[var(--mail-ink-soft)] uppercase shadow-[var(--mail-shadow-raised)] transition hover:border-[var(--mail-brass)] hover:text-[var(--mail-ink)] disabled:cursor-wait disabled:opacity-60"
      disabled={isPreparing}
      onClick={() => void generate({ messageId })}
      type="button"
    >
      <CleanViewActionIcon isPreparing={isPreparing} />
      {cleanViewActionLabel(isPreparing)}
    </button>
  );
}

function CleanViewActionIcon({ isPreparing }: { isPreparing: boolean }) {
  if (isPreparing) return <LoaderCircle className="size-3 animate-spin" />;
  return <Sparkles className="size-3" />;
}

function OverviewIcon({
  isPreparing,
  isSpam,
}: {
  isPreparing: boolean;
  isSpam: boolean;
}) {
  if (isSpam) return <ShieldAlert className="size-3.5" />;
  if (isPreparing) return <LoaderCircle className="size-3.5 animate-spin" />;
  return <Sparkles className="size-3.5" />;
}

function getOverviewSummary(value: string | undefined, isPreparing: boolean) {
  const summary = value?.trim();
  if (summary) return summary;
  if (isPreparing) return "Generating a clean overview and reader view…";
  return "Generate a clean overview and reader view when you want one.";
}

function cleanViewActionLabel(isPreparing: boolean) {
  if (isPreparing) return "Generating";
  return "Generate clean version";
}

function hasGeneratedCleanView(cleanView: ThreadMessageDetail["cleanView"]) {
  if (cleanView?.status === "ready") return true;
  if (cleanView?.summary?.trim()) return true;
  return Boolean(cleanView?.cleanedMarkdown?.trim());
}

function formatCleanViewError(error: string) {
  if (error.includes("Daily AI limit reached")) {
    return "Today’s $1 AI limit has been reached. Try again after the UTC reset.";
  }
  return "The clean view couldn’t be generated. You can try again.";
}
