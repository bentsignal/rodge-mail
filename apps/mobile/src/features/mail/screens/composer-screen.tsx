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
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Paperclip } from "lucide-react-native";

import type { ComposerDraft } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { ComposerFieldName } from "./composer-helpers";
import type { NativeComposerAttachment } from "./use-native-attachments";
import { useMailStore } from "../store";
import { ComposerAttachmentList } from "./composer-attachment-list";
import { ComposerHeader } from "./composer-header";
import {
  canSendFromAccount,
  createComposerDraft,
  getSelectedAccount,
} from "./composer-helpers";
import { ComposerSenderField } from "./composer-sender-field";
import { useNativeAttachments } from "./use-native-attachments";
import { useSendMessage } from "./use-send-message";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Expo Router requires an implicit index signature here.
type ComposerParams = {
  accountId?: string;
  replyToMessageId?: string;
  subject?: string;
  to?: string;
};

export function ComposerScreen({
  variant = "modal",
}: {
  variant?: "modal" | "tab";
}) {
  const params = useLocalSearchParams<ComposerParams>();
  const router = useRouter();
  const accounts = useMailStore((store) => store.accounts);
  const accountFilter = useMailStore((store) => store.accountFilter);
  const [selectedAccountId, setSelectedAccountId] = useState<
    string | undefined
  >(params.accountId);
  const [draft, setDraft] = useState(() => createComposerDraft(params));
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
  const { canSend, idempotencyKey, send } = useSendMessage({
    draft,
    replyToMessageId: params.replyToMessageId,
    selectedAccount,
    setDraft,
    setSelectedAccountId,
    variant,
  });

  function attach() {
    showAttachmentPicker(attachFiles, attachImages);
  }

  function setField(field: ComposerFieldName, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  return (
    <SafeAreaView
      className="bg-background flex-1"
      edges={variant === "tab" ? ["top"] : []}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ComposerHeader
          canSend={canSend}
          onCancel={variant === "modal" ? router.back : undefined}
          onSend={() => void send()}
        />
        <ComposerBody
          key={idempotencyKey}
          accounts={sendingAccounts}
          draft={draft}
          onAttach={attach}
          onChange={setField}
          onSenderChange={setSelectedAccountId}
          onRemoveAttachment={(attachment) => void removeAttachment(attachment)}
          selectedAccountId={selectedAccount?.id}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
