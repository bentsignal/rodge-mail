import { useState } from "react";
import { Check, Copy, ShieldAlert } from "lucide-react";

import { toast } from "@rodge-mail/ui-web/toast";

export function IssuedToken({
  issuedToken,
  onDone,
}: {
  issuedToken: { label: string; token: string };
  onDone: () => void;
}) {
  const [wasCopied, setWasCopied] = useState(false);

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(issuedToken.token);
      setWasCopied(true);
      toast.success("Credential copied.");
    } catch {
      toast.error("Copy failed. Select the credential and copy it manually.");
    }
  }

  return (
    <div className="mail-raised rounded-[13px] border p-4">
      <div className="flex items-start gap-3">
        <span className="bg-destructive/10 text-destructive flex size-9 shrink-0 items-center justify-center rounded-xl">
          <ShieldAlert className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">Save this key now</h3>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            This is the only time Rodge Mail will show the key for
            {` ${issuedToken.label}`}. Store it in the agent’s secret manager.
            Never paste it into chat or source control.
          </p>
        </div>
      </div>
      <code className="mail-inset mt-4 block max-h-24 overflow-auto rounded-[10px] border p-3 font-mono text-[11px] leading-5 break-all select-all">
        {issuedToken.token}
      </code>
      <div className="mt-3 flex justify-end gap-2">
        <button
          className="mail-raised flex h-9 items-center justify-center gap-2 rounded-[9px] border px-3 text-xs font-semibold hover:border-[var(--mail-brass)]"
          onClick={() => void copyToken()}
          type="button"
        >
          <CopyStateIcon wasCopied={wasCopied} />
          <CopyStateLabel wasCopied={wasCopied} />
        </button>
        <button
          className="mail-brass-button h-9 rounded-[9px] px-3 text-xs font-bold"
          onClick={onDone}
          type="button"
        >
          I saved it
        </button>
      </div>
    </div>
  );
}

function CopyStateIcon({ wasCopied }: { wasCopied: boolean }) {
  if (wasCopied) return <Check className="size-3.5" />;
  return <Copy className="size-3.5" />;
}

function CopyStateLabel({ wasCopied }: { wasCopied: boolean }) {
  if (wasCopied) return <>Copied</>;
  return <>Copy key</>;
}
