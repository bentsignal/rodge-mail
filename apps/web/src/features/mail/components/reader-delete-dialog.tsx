import { useState } from "react";

import * as Dialog from "@rodge-mail/ui-web/dialog";

import type { ThreadMessageDetail } from "../types";

export function ArchiveDeleteDialog({
  message,
  onOpenChange,
  permanentlyDelete,
}: {
  message: ThreadMessageDetail | undefined;
  onOpenChange: (open: boolean) => void;
  permanentlyDelete: (message: ThreadMessageDetail) => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  async function confirmDelete() {
    if (!message) return;
    setIsDeleting(true);
    await permanentlyDelete(message);
    setIsDeleting(false);
    onOpenChange(false);
  }
  return (
    <Dialog.Container onOpenChange={onOpenChange} open={message !== undefined}>
      <Dialog.Content className="mail-dialog bg-background max-w-md overflow-hidden rounded-[18px] border p-0">
        <div className="border-b p-6">
          <Dialog.Title className="text-2xl font-semibold tracking-tight">
            Delete permanently?
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-2 text-xs leading-5">
            This permanently removes Rodge Mail’s archived copy and cannot be
            undone. Your provider copy is unchanged.
          </Dialog.Description>
        </div>
        <div className="flex justify-end gap-2 p-5">
          <button
            className="bg-background border-border h-10 rounded-lg border px-4 text-xs font-semibold"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="bg-destructive text-destructive-foreground h-10 rounded-lg px-4 text-xs font-bold disabled:opacity-50"
            disabled={isDeleting}
            onClick={() => void confirmDelete()}
            type="button"
          >
            {getDeleteLabel(isDeleting)}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Container>
  );
}

function getDeleteLabel(isDeleting: boolean) {
  if (isDeleting) return "Deleting…";
  return "Delete permanently";
}
