import { useState } from "react";

import * as Dialog from "@rodge-mail/ui-web/dialog";

import type { ThreadMessageDetail } from "../types";

export function ReaderUnsubscribeDialog({
  message,
  onOpenChange,
  unsubscribe,
}: {
  message: ThreadMessageDetail | undefined;
  onOpenChange: (open: boolean) => void;
  unsubscribe: (message: ThreadMessageDetail) => Promise<void>;
}) {
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  async function confirmUnsubscribe() {
    if (!message) return;
    setIsUnsubscribing(true);
    try {
      await unsubscribe(message);
      onOpenChange(false);
    } catch {
      setIsUnsubscribing(false);
      return;
    }
    setIsUnsubscribing(false);
  }
  const name = message?.mailingList?.displayName ?? "this mailing list";
  return (
    <Dialog.Container onOpenChange={onOpenChange} open={message !== undefined}>
      <Dialog.Content className="mail-dialog mail-workspace max-w-md overflow-hidden rounded-[18px] border p-0">
        <div className="mail-chassis border-b p-6">
          <Dialog.Title className="font-serif text-2xl tracking-[-0.03em]">
            Unsubscribe from {name}?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-5 text-[var(--mail-chassis-foreground)]/70">
            Rodge will ask the sender to remove you using their one-click or
            email unsubscribe method. Either way, current and future advertising
            mail matching this list will go to Spam.
          </Dialog.Description>
        </div>
        <div className="flex justify-end gap-2 p-5">
          <button
            className="mail-raised h-10 rounded-lg border border-[var(--mail-seam)] px-4 text-xs font-semibold"
            disabled={isUnsubscribing}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-lg bg-[var(--mail-highlight)] px-4 text-xs font-bold text-white disabled:opacity-50"
            disabled={isUnsubscribing}
            onClick={() => void confirmUnsubscribe()}
            type="button"
          >
            {getActionLabel(isUnsubscribing)}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Container>
  );
}

export function getUnsubscribeDialogMessage(
  isOpen: boolean,
  selectedMessage: ThreadMessageDetail | undefined,
) {
  if (!isOpen || !selectedMessage?.mailingList) return undefined;
  return selectedMessage;
}

function getActionLabel(isUnsubscribing: boolean) {
  return isUnsubscribing ? "Unsubscribing…" : "Unsubscribe & block";
}
