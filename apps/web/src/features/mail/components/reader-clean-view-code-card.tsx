import { useState } from "react";
import { Check, Copy } from "lucide-react";

import type { ThreadMessageDetail } from "../types";
import type { ReaderViewMode } from "./reader-message";

export function CleanViewCodeCard({
  code,
  viewMode,
}: {
  code: NonNullable<ThreadMessageDetail["cleanView"]>["code"];
  viewMode: ReaderViewMode;
}) {
  const [copied, setCopied] = useState(false);
  if (viewMode !== "clean" || !code) return null;
  const codeValue = code.value;

  async function copyCode() {
    await navigator.clipboard.writeText(codeValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <aside className="mail-inset mt-4 flex items-center gap-5 rounded-[13px] border border-[color-mix(in_srgb,var(--mail-brass)_38%,var(--mail-seam))] px-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="mail-label font-mono text-[8px] leading-3 tracking-[0.16em] uppercase">
          {code.label || "Code"}
        </p>
        <p className="mt-1 font-mono text-2xl leading-8 font-semibold tracking-[0.18em] text-[var(--mail-ink)]">
          {code.value}
        </p>
      </div>
      <button
        aria-label={copied ? "Code copied" : `Copy ${code.label}`}
        aria-pressed={copied}
        className="mail-raised inline-flex h-10 shrink-0 items-center justify-center gap-1.5 self-center rounded-lg border px-3 font-mono text-[9px] font-semibold tracking-[0.08em] uppercase transition hover:border-[var(--mail-brass)]"
        onClick={() => void copyCode()}
        type="button"
      >
        <CodeCopyIcon copied={copied} />
        <CopyLabel copied={copied} />
      </button>
    </aside>
  );
}

function CopyLabel({ copied }: { copied: boolean }) {
  if (copied) return "Copied";
  return "Copy";
}

function CodeCopyIcon({ copied }: { copied: boolean }) {
  if (copied) return <Check className="size-3.5" />;
  return <Copy className="size-3.5" />;
}
