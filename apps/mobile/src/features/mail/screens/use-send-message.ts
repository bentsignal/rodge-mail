import type { Dispatch, SetStateAction } from "react";
// eslint-disable-next-line no-restricted-imports -- Expo Router requires a stable useFocusEffect callback.
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { randomUUID } from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useMutation } from "convex/react";

import type { ComposerDraft } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import { getProviderAttachmentError } from "@rodge-mail/convex/attachments/constants";
import { parseRecipientFields } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { NativeComposerAttachment } from "./use-native-attachments";
import { toConvexId } from "../lib/convex-id";
import {
  createComposerDraft,
  draftCanSend,
  getComposerErrorMessage,
} from "./composer-helpers";
import { getDraftAttachmentIds } from "./use-native-attachments";

type Draft = ComposerDraft<NativeComposerAttachment>;

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
  const enqueuePlainText = useMutation(api.mail.mutations.enqueuePlainText);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [isSending, setIsSending] = useState(false);
  const [showRecipientErrors, setShowRecipientErrors] = useState(false);
  const sendInFlight = useRef(false);
  const composerIsActive = useComposerIsActive();
  const canSend = draftCanSend(draft);
  const parsedRecipients = parseRecipientFields(draft);
  const recipientErrors = showRecipientErrors
    ? getRecipientErrors(parsedRecipients)
    : {};

  async function send() {
    if (!canSend || sendInFlight.current) return;
    if (!canQueueDraft(draft, selectedAccount)) return;
    const account = selectedAccount;
    if (!account) return;
    setShowRecipientErrors(true);
    if (hasRecipientErrors(parsedRecipients)) return;
    sendInFlight.current = true;
    setIsSending(true);
    let enqueueStatus: "pending" | "sending" | "sent";
    try {
      const result = await enqueuePlainText({
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
      enqueueStatus = result.status;
    } catch (error) {
      sendInFlight.current = false;
      handleSendError({
        error,
        isActive: composerIsActive.current,
        setIsSending,
        variant,
      });
      return;
    }
    finishSuccessfulSend({
      closeModal: router.back,
      isActive: composerIsActive.current,
      navigateInbox: () => router.navigate("/(tabs)/(inbox)"),
      resetTab: () => {
        setDraft(createComposerDraft({}));
        setSelectedAccountId(undefined);
        setIdempotencyKey(newIdempotencyKey());
        setShowRecipientErrors(false);
        sendInFlight.current = false;
        setIsSending(false);
      },
      status: enqueueStatus,
      variant,
    });
  }

  return {
    canSend: canSend && !isSending,
    idempotencyKey,
    recipientErrors,
    send,
  };
}

function useComposerIsActive() {
  const isActive = useRef(false);
  useFocusEffect(
    useCallback(() => {
      isActive.current = true;
      return () => {
        isActive.current = false;
      };
    }, []),
  );
  return isActive;
}

function handleSendError({
  error,
  isActive,
  setIsSending,
  variant,
}: {
  error: unknown;
  isActive: boolean;
  setIsSending: (value: boolean) => void;
  variant: "modal" | "tab";
}) {
  if (!isActive && variant === "modal") return;
  setIsSending(false);
  if (!isActive) return;
  Alert.alert("Couldn’t queue this message", getComposerErrorMessage(error));
}

function finishSuccessfulSend({
  closeModal,
  isActive,
  navigateInbox,
  resetTab,
  status,
  variant,
}: {
  closeModal: () => void;
  isActive: boolean;
  navigateInbox: () => void;
  resetTab: () => void;
  status: "pending" | "sending" | "sent";
  variant: "modal" | "tab";
}) {
  if (variant === "modal") {
    if (!isActive) return;
    showEnqueueConfirmation(status);
    closeModal();
    return;
  }
  resetTab();
  if (!isActive) return;
  showEnqueueConfirmation(status);
  navigateInbox();
}

function showEnqueueConfirmation(status: "pending" | "sending" | "sent") {
  void Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success,
  ).catch(() => undefined);
  const title =
    status === "sent"
      ? "Message already delivered"
      : status === "sending"
        ? "Delivery already in progress"
        : "Message queued";
  Alert.alert(title, "Track its live delivery status in Settings.");
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
  if (draft.attachments.some((attachment) => attachment.status !== "ready")) {
    Alert.alert(
      "Attachments are still uploading",
      "Wait for every file or remove the failed attachment.",
    );
    return false;
  }
  if (!account) {
    Alert.alert(
      "Connect an account first",
      "Add Gmail, Microsoft 365, or iCloud from Rodge Mail on the web before sending.",
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
