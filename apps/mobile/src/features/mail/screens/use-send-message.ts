import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Alert } from "react-native";
import { randomUUID } from "expo-crypto";
import { useRouter } from "expo-router";

import type { ComposerDraft } from "@rodge-mail/features/mail";
import { getProviderAttachmentError } from "@rodge-mail/convex/attachments/constants";
import { parseRecipientFields } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { NativeComposerAttachment } from "./use-native-attachments";
import { toConvexId } from "../lib/convex-id";
import { useOutgoingMail } from "../outgoing/outgoing-store";
import { createComposerDraft, draftCanSend } from "./composer-helpers";
import { getDraftAttachmentIds } from "./use-native-attachments";

type Draft = ComposerDraft<NativeComposerAttachment>;

/**
 * Send hands the message to the outgoing store and closes the composer at
 * once; delivery progress and failures show in the send banner and Sent.
 */
export function useSendMessage({
  draft,
  replyToMessageId,
  selectedAccount,
  setDraft,
  setSelectedAccountId,
  variant,
}: {
  draft: Draft;
  replyToMessageId?: string;
  selectedAccount: MobileMailAccount | undefined;
  setDraft: Dispatch<SetStateAction<Draft>>;
  setSelectedAccountId: Dispatch<SetStateAction<string | undefined>>;
  variant: "modal" | "tab";
}) {
  const router = useRouter();
  const queueSend = useOutgoingMail((store) => store.send);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [showRecipientErrors, setShowRecipientErrors] = useState(false);
  const canSend = draftCanSend(draft);
  const parsedRecipients = parseRecipientFields(draft);
  const recipientErrors = showRecipientErrors
    ? getRecipientErrors(parsedRecipients)
    : {};

  function send() {
    if (!canSend) return;
    if (!canQueueDraft(draft, selectedAccount)) return;
    const account = selectedAccount;
    if (!account) return;
    setShowRecipientErrors(true);
    if (hasRecipientErrors(parsedRecipients)) return;
    queueSend({
      accountId: toConvexId<"mailAccounts">(account.id),
      attachmentIds: getDraftAttachmentIds(draft.attachments),
      bcc: parsedRecipients.recipients.bcc,
      cc: parsedRecipients.recipients.cc,
      idempotencyKey,
      plainText: draft.body,
      replyToMessageId: replyToMessageId
        ? toConvexId<"messages">(replyToMessageId)
        : undefined,
      subject: draft.subject.trim(),
      to: parsedRecipients.recipients.to,
    });
    if (variant === "modal") {
      router.back();
      return;
    }
    setDraft(createComposerDraft({}));
    setSelectedAccountId(undefined);
    setIdempotencyKey(newIdempotencyKey());
    setShowRecipientErrors(false);
    router.navigate("/(tabs)/(inbox)");
  }

  return { canSend, idempotencyKey, recipientErrors, send };
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
    bcc: getInvalidRecipientMessage(result.invalid.bcc),
    cc: getInvalidRecipientMessage(result.invalid.cc),
    to:
      getInvalidRecipientMessage(result.invalid.to) ??
      getMissingToMessage(result.recipients.to.length),
  };
}

function getInvalidRecipientMessage(invalid: string[]) {
  return invalid.length > 0 ? `Invalid: ${invalid.join(", ")}` : undefined;
}

function getMissingToMessage(recipientCount: number) {
  return recipientCount === 0
    ? "Add at least one valid email address."
    : undefined;
}

function canQueueDraft(draft: Draft, account: MobileMailAccount | undefined) {
  if (!account) {
    Alert.alert(
      "Connect an account first",
      "Add Gmail, Microsoft 365, or iCloud before sending.",
    );
    return false;
  }
  const attachmentError = getProviderAttachmentError(
    account.provider,
    draft.attachments,
  );
  if (!attachmentError) return true;
  Alert.alert("Attachment unavailable", attachmentError);
  return false;
}

function newIdempotencyKey() {
  return `rodge-native-${randomUUID()}`;
}
