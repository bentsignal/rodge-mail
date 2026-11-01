import { useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import * as Dialog from "@rodge-mail/ui-web/dialog";
import { toast } from "@rodge-mail/ui-web/toast";

import type { MailAccountView } from "../types";
import { optimisticallyRemoveAccount } from "../account-removal-optimistic";
import { useLiveMail } from "../live-data";
import { getErrorMessage } from "../live-data-utils";
import { useMailStore } from "../store";
import { useMailboxNavigation } from "../use-mailbox-navigation";

export function RemoveAccountButton({
  account,
  providerLabel,
}: {
  account: MailAccountView;
  providerLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const { selectedThread } = useLiveMail();
  const showMailbox = useMailboxNavigation();
  const removeAccount = useMutation(
    api.accounts.mutations.remove,
  ).withOptimisticUpdate(optimisticallyRemoveAccount);

  function remove() {
    setIsOpen(false);
    if (accountFilter === account._id) showMailbox("all");
    else if (selectedThread?.accountId === account._id) {
      showMailbox(accountFilter);
    }
    removeAccount({ accountId: account._id }).catch((error: unknown) =>
      toast.error(getErrorMessage(error, "Could not remove this account.")),
    );
  }

  return (
    <Dialog.Container onOpenChange={setIsOpen} open={isOpen}>
      <Dialog.Trigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 shrink-0 rounded-lg px-2.5 text-xs font-semibold transition-colors"
          type="button"
        >
          Remove
        </button>
      </Dialog.Trigger>
      <Dialog.Content className="mail-dialog bg-background max-w-md overflow-hidden rounded-[18px] border p-0">
        <div className="border-b p-6">
          <Dialog.Title className="text-2xl font-semibold tracking-tight">
            Remove {account.label}?
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-2 text-xs leading-5">
            {getRemovalMessage(account, providerLabel)}
          </Dialog.Description>
        </div>
        <div className="flex justify-end gap-2 p-5">
          <button
            className="bg-background border-border h-10 rounded-lg border px-4 text-xs font-semibold"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-xs font-bold"
            onClick={remove}
            type="button"
          >
            Remove account
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Container>
  );
}

function getRemovalMessage(account: MailAccountView, providerLabel: string) {
  const removes = `Removes ${account.address} and its mail from Rodge Mail.`;
  if (account.provider === "hosted") {
    return `${removes} The address stops receiving mail.`;
  }
  return `${removes} Nothing is deleted from ${providerLabel}.`;
}
