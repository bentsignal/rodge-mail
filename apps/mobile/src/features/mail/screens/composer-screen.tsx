import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { randomUUID } from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { Paperclip, Send, X } from "lucide-react-native";

import type { ComposerDraft } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import { getProviderAttachmentError } from "@rodge-mail/convex/attachments/constants";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { ComposerFieldName } from "./composer-helpers";
import type { NativeComposerAttachment } from "./use-native-attachments";
import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";
import { useMailStore } from "../store";
import { ComposerAttachmentList } from "./composer-attachment-list";
import {
  canSendFromAccount,
  createComposerDraft,
  draftCanSend,
  getComposerErrorMessage,
  getSelectedAccount,
  parseAddresses,
} from "./composer-helpers";
import { ComposerSenderField } from "./composer-sender-field";
import {
  getDraftAttachmentIds,
  useNativeAttachments,
} from "./use-native-attachments";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Expo Router requires an implicit index signature here.
type ComposerParams = {
  accountId?: string;
  replyToMessageId?: string;
  subject?: string;
  to?: string;
};

export function ComposerScreen() {
  const params = useLocalSearchParams<ComposerParams>();
  const router = useRouter();
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const enqueuePlainText = useMutation(api.mail.mutations.enqueuePlainText);
  const [idempotencyKey] = useState(() => `rodge-native-${randomUUID()}`);
  const [selectedAccountId, setSelectedAccountId] = useState<
    string | undefined
  >(params.accountId);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState(() => createComposerDraft(params));
  const canSend = draftCanSend(draft);
  const sendingAccounts = accounts.filter(canSendFromAccount);
  const selectedAccount = getSelectedAccount(
    sendingAccounts,
    selectedAccountId,
    accountFilter,
  );
  const { attachFiles, attachImages, removeAttachment } = useNativeAttachments({
    draft,
    provider: selectedAccount?.provider,
    setDraft,
  });

  function attach() {
    showAttachmentPicker(attachFiles, attachImages);
  }

  function setField(field: ComposerFieldName, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  async function send() {
    if (!canSend || isSending) return;
    if (draft.attachments.some((attachment) => attachment.status !== "ready")) {
      Alert.alert(
        "Attachments are still uploading",
        "Wait for every file or remove the failed attachment.",
      );
      return;
    }
    const account = selectedAccount;
    if (!account) {
      Alert.alert(
        "Connect an account first",
        "Add Gmail, Microsoft 365, or iCloud from Rodge Mail on the web before sending.",
      );
      return;
    }
    if (!providerAttachmentsCanSend(account.provider, draft.attachments))
      return;
    const to = parseAddresses(draft.to);
    if (to.length === 0) {
      Alert.alert("Add a recipient", "Enter at least one valid email address.");
      return;
    }
    setIsSending(true);
    try {
      await enqueuePlainText({
        accountId: toConvexId<"mailAccounts">(account.id),
        idempotencyKey,
        to,
        cc: parseAddresses(draft.cc),
        bcc: parseAddresses(draft.bcc),
        subject: draft.subject.trim(),
        plainText: draft.body,
        replyToMessageId: toReplyMessageId(params.replyToMessageId),
        attachmentIds: getDraftAttachmentIds(draft.attachments),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      setIsSending(false);
      Alert.alert(
        "Couldn’t queue this message",
        getComposerErrorMessage(error),
      );
    }
  }

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ComposerHeader
        canSend={canSend && !isSending}
        onCancel={router.back}
        onSend={() => void send()}
      />
      <ComposerBody
        accounts={sendingAccounts}
        draft={draft}
        onAttach={attach}
        onChange={setField}
        onSenderChange={setSelectedAccountId}
        onRemoveAttachment={(attachment) => void removeAttachment(attachment)}
        selectedAccountId={selectedAccount?.id}
      />
    </KeyboardAvoidingView>
  );
}

function providerAttachmentsCanSend(
  provider: MobileMailAccount["provider"],
  attachments: NativeComposerAttachment[],
) {
  const error = getProviderAttachmentError(provider, attachments);
  if (!error) return true;
  Alert.alert("Attachment unavailable", error);
  return false;
}

function showAttachmentPicker(
  attachFiles: () => Promise<void>,
  attachImages: () => Promise<void>,
) {
  Alert.alert("Add attachment", undefined, [
    { text: "Photos", onPress: () => void attachImages() },
    { text: "Files", onPress: () => void attachFiles() },
    { text: "Cancel", style: "cancel" },
  ]);
}

function toReplyMessageId(messageId: string | undefined) {
  return messageId ? toConvexId<"messages">(messageId) : undefined;
}

function ComposerBody({
  accounts,
  draft,
  onAttach,
  onChange,
  onRemoveAttachment,
  onSenderChange,
  selectedAccountId,
}: {
  accounts: MobileMailAccount[];
  draft: ComposerDraft<NativeComposerAttachment>;
  onAttach: () => void;
  onChange: (field: ComposerFieldName, value: string) => void;
  onRemoveAttachment: (attachment: NativeComposerAttachment) => void;
  onSenderChange: (accountId: string) => void;
  selectedAccountId: string | undefined;
}) {
  return (
    <ScrollView
      contentContainerClassName="px-4 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <ComposerSenderField
        accounts={accounts}
        onChange={onSenderChange}
        selectedAccountId={selectedAccountId}
      />
      <ComposerField
        autoCapitalize="none"
        defaultValue={draft.to}
        keyboardType="email-address"
        label="To"
        onChangeText={(value) => onChange("to", value)}
      />
      <ComposerField
        autoCapitalize="none"
        defaultValue={draft.cc}
        keyboardType="email-address"
        label="CC"
        onChangeText={(value) => onChange("cc", value)}
      />
      <ComposerField
        autoCapitalize="none"
        defaultValue={draft.bcc}
        keyboardType="email-address"
        label="BCC"
        onChangeText={(value) => onChange("bcc", value)}
      />
      <ComposerField
        defaultValue={draft.subject}
        label="Subject"
        onChangeText={(value) => onChange("subject", value)}
      />
      <TextInput
        accessibilityLabel="Message body"
        autoFocus
        className="text-foreground min-h-72 py-4 text-base leading-6"
        defaultValue={draft.body}
        multiline
        placeholder="Write a message"
        placeholderTextColor="#777777"
        textAlignVertical="top"
        onChangeText={(value) => onChange("body", value)}
      />
      <ComposerAttachmentList
        attachments={draft.attachments}
        onRemove={onRemoveAttachment}
      />
      <Pressable
        accessibilityLabel="Add attachments"
        accessibilityRole="button"
        className="border-border flex-row items-center justify-center gap-2 rounded-xl border py-3"
        onPress={onAttach}
      >
        <Paperclip color="#777777" size={18} />
        <Text className="text-foreground font-semibold">Attach</Text>
      </Pressable>
    </ScrollView>
  );
}

function ComposerHeader({
  canSend,
  onCancel,
  onSend,
}: {
  canSend: boolean;
  onCancel: () => void;
  onSend: () => void;
}) {
  const foreground = useColor("foreground");

  return (
    <View className="border-border flex-row items-center justify-between border-b px-4 py-3">
      <Pressable
        accessibilityLabel="Close composer"
        accessibilityRole="button"
        className="p-2"
        hitSlop={10}
        onPress={onCancel}
      >
        <X color={foreground} size={22} />
      </Pressable>
      <Text className="text-foreground text-lg font-bold">New message</Text>
      <Pressable
        accessibilityLabel="Send email"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSend }}
        className="p-2"
        disabled={!canSend}
        hitSlop={10}
        onPress={onSend}
      >
        <Send color={foreground} opacity={canSend ? 1 : 0.3} size={21} />
      </Pressable>
    </View>
  );
}

function ComposerField({
  label,
  ...props
}: {
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="border-border flex-row items-center gap-3 border-b py-2">
      <Text className="text-muted-foreground w-16 text-base">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        className="text-foreground min-h-10 min-w-0 flex-1 text-base"
        placeholderTextColor="#777777"
        {...props}
      />
    </View>
  );
}
