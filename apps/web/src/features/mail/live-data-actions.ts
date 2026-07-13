import type { NavigateFn } from "@tanstack/react-router";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import { getReplyAddress } from "@rodge-mail/features/mail";
import { toast } from "@rodge-mail/ui-web/toast";

import type { InboxMessage, MailAccountView, MailThreadDetail } from "./types";
import { env } from "~/env";
import { getErrorMessage } from "./live-data-utils";
import { useMailStore } from "./store";
import { useSyncAll } from "./use-sync-all";
import { useThreadActions } from "./use-thread-actions";

export function useLiveMailActions(
  accounts: MailAccountView[],
  selectedThread: MailThreadDetail | undefined,
  mailMode: "archive" | "inbox",
  unreadSession?: {
    forget: (threadId: InboxMessage["threadId"]) => void;
    preserve: (message: InboxMessage) => void;
  },
) {
  const navigate = useNavigate();
  const clearSelection = useMailStore((store) => store.clearSelection);
  const openReply = useMailStore((store) => store.openReply);
  const threadActions = useThreadActions(unreadSession);
  const archiveActions = useArchiveActions({
    clearSelection,
    forgetUnreadThread: unreadSession?.forget,
    mailMode,
    navigate,
  });
  const seed = useSeedDemoAction();
  const sync = useSyncAll(accounts);
  function replyToSelectedThread() {
    const latestMessage = selectedThread?.messages.at(-1);
    if (!selectedThread || !latestMessage) return;
    const address = getReplyAddress(
      selectedThread.messages,
      selectedThread.account.address,
    );
    if (!address) return;
    openReply({
      accountId: selectedThread.accountId,
      address,
      messageId: latestMessage._id,
      subject: selectedThread.subject,
    });
  }
  return {
    ...archiveActions,
    ...seed,
    ...sync,
    ...threadActions,
    replyToSelectedThread,
  };
}

function useArchiveActions({
  clearSelection,
  forgetUnreadThread,
  mailMode,
  navigate,
}: {
  clearSelection: () => void;
  forgetUnreadThread?: (threadId: InboxMessage["threadId"]) => void;
  mailMode: "archive" | "inbox";
  navigate: NavigateFn;
}) {
  const archive = useMutation(api.mail.mutations.archiveThread);
  const restore = useMutation(api.mail.archiveMutations.restoreArchivedThread);
  const permanentlyDelete = useMutation(
    api.mail.archiveMutations.permanentlyDeleteArchivedThread,
  );
  const bulkActions = useArchiveBulkActions({
    clearSelection,
    forgetUnreadThread,
    navigate,
  });
  async function archiveThread(message: Pick<InboxMessage, "threadId">) {
    try {
      await archive({ threadId: message.threadId });
      forgetUnreadThread?.(message.threadId);
      clearSelection();
      await navigate({
        to: mailMode === "archive" ? "/archive" : "/",
        search: (previous) => previous,
      });
      toast.success("Archived in Rodge. Your provider copy is unchanged.");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Could not archive the conversation."),
      );
    }
  }
  async function restoreArchivedThread(
    message: Pick<InboxMessage, "threadId">,
  ) {
    try {
      await restore({ threadId: message.threadId });
      clearSelection();
      await navigate({ to: "/archive", search: (previous) => previous });
      toast.success("Conversation restored to the inbox.");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Could not restore the conversation."),
      );
    }
  }
  async function permanentlyDeleteArchivedThread(
    message: Pick<InboxMessage, "threadId">,
  ) {
    try {
      await permanentlyDelete({ threadId: message.threadId });
      clearSelection();
      await navigate({ to: "/archive", search: (previous) => previous });
      toast.success("Archived conversation permanently deleted.");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Could not delete the archived conversation."),
      );
    }
  }
  return {
    ...bulkActions,
    archiveThread,
    permanentlyDeleteArchivedThread,
    restoreArchivedThread,
  };
}

function useArchiveBulkActions({
  clearSelection,
  forgetUnreadThread,
  navigate,
}: {
  clearSelection: () => void;
  forgetUnreadThread?: (threadId: InboxMessage["threadId"]) => void;
  navigate: NavigateFn;
}) {
  const archive = useMutation(api.mail.mutations.archiveThread);
  const restore = useMutation(api.mail.archiveMutations.restoreArchivedThread);
  const permanentlyDelete = useMutation(
    api.mail.archiveMutations.permanentlyDeleteArchivedThread,
  );
  const clearBulkSelection = useMailStore((store) => store.clearBulkSelection);
  const setBulkSelectionActive = useMailStore(
    (store) => store.setBulkSelectionActive,
  );
  function complete() {
    clearSelection();
    clearBulkSelection();
    setBulkSelectionActive(false);
  }
  async function archiveThreads(messages: Pick<InboxMessage, "threadId">[]) {
    await runBulkAction({
      action: async (message) => {
        await archive({ threadId: message.threadId });
        forgetUnreadThread?.(message.threadId);
      },
      complete,
      errorLabel: "Could not archive the conversations.",
      messages,
      navigate,
      successLabel: "archived in Rodge",
      to: "/",
    });
  }
  async function restoreArchivedThreads(
    messages: Pick<InboxMessage, "threadId">[],
  ) {
    await runBulkAction({
      action: async (message) => await restore({ threadId: message.threadId }),
      complete,
      errorLabel: "Could not restore the conversations.",
      messages,
      navigate,
      successLabel: "restored to the inbox",
      to: "/archive",
    });
  }
  async function permanentlyDeleteArchivedThreads(
    messages: Pick<InboxMessage, "threadId">[],
  ) {
    await runBulkAction({
      action: async (message) =>
        await permanentlyDelete({ threadId: message.threadId }),
      complete,
      errorLabel: "Could not delete the archived conversations.",
      messages,
      navigate,
      successLabel: "permanently deleted",
      to: "/archive",
    });
  }
  return {
    archiveThreads,
    permanentlyDeleteArchivedThreads,
    restoreArchivedThreads,
  };
}

async function runBulkAction({
  action,
  complete,
  errorLabel,
  messages,
  navigate,
  successLabel,
  to,
}: {
  action: (message: Pick<InboxMessage, "threadId">) => Promise<unknown>;
  complete: () => void;
  errorLabel: string;
  messages: Pick<InboxMessage, "threadId">[];
  navigate: NavigateFn;
  successLabel: string;
  to: "/" | "/archive";
}) {
  if (messages.length === 0) return;
  try {
    await Promise.all(messages.map(action));
    complete();
    await navigate({ to, search: (previous) => previous });
    toast.success(
      `${messages.length} conversation${messages.length === 1 ? "" : "s"} ${successLabel}.`,
    );
  } catch (error) {
    toast.error(getErrorMessage(error, errorLabel));
  }
}

function useSeedDemoAction() {
  const seedDemo = useMutation(api.devSeed.seedDemoMail);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  async function seedDemoMail() {
    if (env.VITE_NODE_ENV !== "development") return;
    setIsSeedingDemo(true);
    try {
      const result = await seedDemo();
      toast.success(
        result.insertedMessages > 0
          ? `Added ${result.insertedMessages} development messages.`
          : "Development mail is already seeded.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not seed development mail."));
    }
    setIsSeedingDemo(false);
  }
  return { isSeedingDemo, seedDemoMail };
}
