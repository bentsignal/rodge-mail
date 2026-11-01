/* eslint-disable @typescript-eslint/consistent-type-assertions -- Draft attachment IDs are runtime-validated Convex mutation results. */
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";
import { getProviderAttachmentError } from "@rodge-mail/convex/attachments/constants";
import {
  getSentSubject,
  parseRecipientFields,
} from "@rodge-mail/features/mail";
import { toast } from "@rodge-mail/ui-web/toast";

import type { ComposerSnapshot } from "../store";
import { useLiveMail } from "../live-data";
import { addSendingOutboxRow } from "../outbox-optimistic";
import { useMailStore } from "../store";
import { getSendingAccount } from "./compose-account-field";
import { useComposeAttachments } from "./use-compose-attachments";

const NO_RECIPIENT_ERRORS = { bcc: undefined, cc: undefined, to: undefined };

/**
 * Send closes the composer at once and the message shows in the outbox as
 * sending. A failed enqueue is reported afterwards, with the draft one click
 * away.
 */
export function useComposeSend() {
  const draftCanSend = useMailStore((store) => store.composerCanSend);
  const completeEnqueue = useMailStore(
    (store) => store.completeComposerEnqueue,
  );
  const restoreComposer = useMailStore((store) => store.restoreComposer);
  const composerAccountId = useMailStore((store) => store.composerAccountId);
  const replyToMessageId = useMailStore(
    (store) => store.composerReplyToMessageId,
  );
  const draft = useMailStore((store) => store.composerDraft);
  const idempotencyKey = useMailStore((store) => store.idempotencyKey);
  const enqueue = useMutation(
    api.mail.mutations.enqueuePlainText,
  ).withOptimisticUpdate(addSendingOutboxRow);
  const { accounts } = useLiveMail();
  const account = getSendingAccount(accounts, composerAccountId);
  const { attachFiles, attachmentsAreReady } = useComposeAttachments(
    account?.provider,
  );
  const [showRecipientErrors, setShowRecipientErrors] = useState(false);
  const recipients = parseRecipientFields(draft);
  const canSend = draftCanSend && attachmentsAreReady;
  const recipientErrors = showRecipientErrors
    ? getRecipientErrors(recipients)
    : NO_RECIPIENT_ERRORS;

  function send() {
    if (!canSend) return;
    if (!account) {
      toast.error("Connect a mail account before sending.");
      return;
    }
    const attachmentError = getProviderAttachmentError(
      account.provider,
      draft.attachments,
    );
    if (attachmentError) {
      toast.error(attachmentError);
      return;
    }
    setShowRecipientErrors(true);
    if (hasRecipientErrors(recipients)) return;

    const snapshot = {
      accountId: account._id,
      draft,
      idempotencyKey,
      replyToMessageId,
    } satisfies ComposerSnapshot;
    enqueue({
      accountId: account._id,
      attachmentIds: draft.attachments.flatMap((attachment) =>
        attachment.draftAttachmentId
          ? [attachment.draftAttachmentId as Id<"draftAttachments">]
          : [],
      ),
      bcc: recipients.recipients.bcc,
      cc: recipients.recipients.cc,
      idempotencyKey,
      plainText: draft.body,
      replyToMessageId,
      subject: draft.subject.trim(),
      to: recipients.recipients.to,
    }).catch((error: unknown) => {
      toast.error(`Couldn’t send “${getSentSubject(draft.subject)}”`, {
        action: { label: "Edit", onClick: () => restoreComposer(snapshot) },
        closeButton: true,
        description: getSendError(error),
        duration: Number.POSITIVE_INFINITY,
      });
    });
    completeEnqueue();
  }

  return {
    attachFiles,
    canSend,
    recipientErrors,
    send,
  };
}

function hasRecipientErrors(result: ReturnType<typeof parseRecipientFields>) {
  return (
    result.recipients.to.length === 0 ||
    result.invalid.to.length > 0 ||
    result.invalid.cc.length > 0 ||
    result.invalid.bcc.length > 0
  );
}

function getRecipientErrors(result: ReturnType<typeof parseRecipientFields>) {
  return {
    bcc: getInvalidMessage(result.invalid.bcc),
    cc: getInvalidMessage(result.invalid.cc),
    to:
      getInvalidMessage(result.invalid.to) ??
      (result.recipients.to.length === 0
        ? "Add at least one valid email address."
        : undefined),
  };
}

function getInvalidMessage(invalid: string[]) {
  return invalid.length > 0 ? `Invalid: ${invalid.join(", ")}` : undefined;
}

function getSendError(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  return "Try again in a moment.";
}
