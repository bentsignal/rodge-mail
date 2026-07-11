import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Alert } from "react-native";
import { randomUUID } from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";

import type { ComposerDraft } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import { getProviderAttachmentError } from "@rodge-mail/convex/attachments/constants";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { NativeComposerAttachment } from "./use-native-attachments";
import { toConvexId } from "../lib/convex-id";
import {
  createComposerDraft,
  draftCanSend,
  getComposerErrorMessage,
  parseAddresses,
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
  const canSend = draftCanSend(draft);

  async function send() {
    if (!canSend || isSending || !canQueueDraft(draft, selectedAccount)) return;
    const account = selectedAccount;
    if (!account) return;
    const to = parseAddresses(draft.to);
    if (to.length === 0) {
      Alert.alert("Add a recipient", "Enter at least one valid email address.");
      return;
    }
    setIsSending(true);
    try {
      await enqueuePlainText({
        accountId: toConvexId<"mailAccounts">(account.id),
        attachmentIds: getDraftAttachmentIds(draft.attachments),
        bcc: parseAddresses(draft.bcc),
        cc: parseAddresses(draft.cc),
        idempotencyKey,
        plainText: draft.body,
        replyToMessageId: replyToMessageId
          ? toConvexId<"messages">(replyToMessageId)
          : undefined,
        subject: draft.subject.trim(),
        to,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (variant === "modal") {
        router.back();
        return;
      }
      setDraft(createComposerDraft({}));
      setSelectedAccountId(undefined);
      setIdempotencyKey(newIdempotencyKey());
      setIsSending(false);
      router.navigate("/(tabs)/(inbox)");
    } catch (error) {
      setIsSending(false);
      Alert.alert(
        "Couldn’t queue this message",
        getComposerErrorMessage(error),
      );
    }
  }

  return { canSend: canSend && !isSending, idempotencyKey, send };
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
