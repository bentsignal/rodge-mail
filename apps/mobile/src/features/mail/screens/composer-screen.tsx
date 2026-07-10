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

import type { MobileMailAccount } from "../lib/convex-mail";
import type { NativeComposerAttachment } from "./use-native-attachments";
import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";
import { useMailStore } from "../store";
import { ComposerAttachmentList } from "./composer-attachment-list";
import { ComposerSenderField } from "./composer-sender-field";
import {
  getDraftAttachmentIds,
  useNativeAttachments,
} from "./use-native-attachments";

export function ComposerScreen() {
  const params = useLocalSearchParams<{ subject?: string; to?: string }>();
  const router = useRouter();
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const enqueuePlainText = useMutation(api.mail.mutations.enqueuePlainText);
  const [idempotencyKey] = useState(() => `rodge-native-${randomUUID()}`);
  const [selectedAccountId, setSelectedAccountId] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft<NativeComposerAttachment>>({
    attachments: [],
    body: "",
    cc: "",
    subject: params.subject ?? "",
    to: params.to ?? "",
  });
  const { attachImages, removeAttachment } = useNativeAttachments({
    draft,
    setDraft,
  });
  const canSend = draftCanSend(draft);
  const sendingAccounts = accounts.filter(canSendFromAccount);
  const selectedAccount = getSelectedAccount(
    sendingAccounts,
    selectedAccountId,
    accountFilter,
  );

  function setField(field: "body" | "cc" | "subject" | "to", value: string) {
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
        subject: draft.subject.trim(),
        plainText: draft.body,
        attachmentIds: getDraftAttachmentIds(draft.attachments),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      setIsSending(false);
      Alert.alert("Couldn’t queue this message", getErrorMessage(error));
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
        onAttach={() => void attachImages()}
        onChange={setField}
        onSenderChange={setSelectedAccountId}
        onRemoveAttachment={(attachment) => void removeAttachment(attachment)}
        selectedAccountId={selectedAccount?.id}
      />
    </KeyboardAvoidingView>
  );
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
  onChange: (field: "body" | "cc" | "subject" | "to", value: string) => void;
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
        accessibilityLabel="Attach photos"
        accessibilityRole="button"
        className="border-border flex-row items-center justify-center gap-2 rounded-xl border py-3"
        onPress={onAttach}
      >
        <Paperclip color="#777777" size={18} />
        <Text className="text-foreground font-semibold">Attach photos</Text>
      </Pressable>
    </ScrollView>
  );
}

function getSelectedAccount(
  accounts: MobileMailAccount[],
  selectedAccountId: string | undefined,
  accountFilter: string,
) {
  return (
    accounts.find((account) => account.id === selectedAccountId) ??
    accounts.find((account) => account.id === accountFilter) ??
    accounts[0]
  );
}

function canSendFromAccount(account: MobileMailAccount) {
  return (
    ["gmail", "icloud", "microsoft"].includes(account.provider) &&
    ["connected", "syncing"].includes(account.status)
  );
}

function draftCanSend(draft: ComposerDraft<NativeComposerAttachment>) {
  return (
    draft.to.trim().length > 0 &&
    draft.body.trim().length > 0 &&
    draft.attachments.every((attachment) => attachment.status === "ready")
  );
}

function parseAddresses(value: string) {
  return value
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter((address) => address.includes("@"))
    .map((address) => ({ address }));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Rodge Mail could not add this message to the delivery queue.";
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
