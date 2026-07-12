import { useState } from "react";
import { Alert, ScrollView, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { ComposerDraft, RecipientFields } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { ComposerFieldName } from "./composer-helpers";
import type { NativeComposerAttachment } from "./use-native-attachments";
import {
  PostalPaperBackground,
  PostalSurface,
} from "~/features/theme/postal-surface";
import { useColor } from "~/hooks/use-color";
import { useMailStore } from "../store";
import { ComposerAttachButton } from "./composer-attach-button";
import { ComposerAttachmentList } from "./composer-attachment-list";
import { ComposerField, ComposerSectionLabel } from "./composer-field";
import {
  canSendFromAccount,
  createComposerDraft,
  getSelectedAccount,
} from "./composer-helpers";
import { ComposerNavigationHeader } from "./composer-navigation-header";
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
  const { canSend, idempotencyKey, recipientErrors, send } = useSendMessage({
    draft,
    replyToMessageId: params.replyToMessageId,
    selectedAccount,
    setDraft,
    setSelectedAccountId,
    variant,
  });
  const backgroundColor = useColor("background");

  function attach() {
    showAttachmentPicker(attachFiles, attachImages);
  }

  function setField(field: ComposerFieldName, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  return (
    <View className="bg-background flex-1" style={{ backgroundColor, flex: 1 }}>
      <ComposerNavigationHeader
        canSend={canSend}
        variant={variant}
        onCancel={router.back}
        onSend={() => void send()}
      />
      <ComposerBody
        key={idempotencyKey}
        accounts={sendingAccounts}
        draft={draft}
        onAttach={attach}
        onChange={setField}
        onOpenSettings={() => router.navigate("/(tabs)/(settings)")}
        onSenderChange={setSelectedAccountId}
        onRemoveAttachment={(attachment) => void removeAttachment(attachment)}
        recipientErrors={recipientErrors}
        selectedAccountId={selectedAccount?.id}
        autoFocusBody={variant === "modal"}
      />
    </View>
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
  onOpenSettings,
  onRemoveAttachment,
  recipientErrors,
  onSenderChange,
  selectedAccountId,
  autoFocusBody,
}: {
  accounts: MobileMailAccount[];
  draft: ComposerDraft<NativeComposerAttachment>;
  onAttach: () => void;
  onChange: (field: ComposerFieldName, value: string) => void;
  onOpenSettings: () => void;
  onRemoveAttachment: (attachment: NativeComposerAttachment) => void;
  recipientErrors: Partial<RecipientFields<string>>;
  onSenderChange: (accountId: string) => void;
  selectedAccountId: string | undefined;
  autoFocusBody: boolean;
}) {
  const paper = useColor("paper");

  return (
    <PostalPaperBackground
      className="min-h-0"
      style={{ backgroundColor: paper }}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pt-4"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <ComposerFieldsSurface
          accounts={accounts}
          draft={draft}
          onChange={onChange}
          onOpenSettings={onOpenSettings}
          onSenderChange={onSenderChange}
          recipientErrors={recipientErrors}
          selectedAccountId={selectedAccountId}
        />
        <ComposerMessageSurface
          autoFocus={autoFocusBody}
          draft={draft}
          onChange={onChange}
          onRemoveAttachment={onRemoveAttachment}
        />
        <ComposerAttachButton onAttach={onAttach} />
      </ScrollView>
    </PostalPaperBackground>
  );
}

function ComposerFieldsSurface({
  accounts,
  draft,
  onChange,
  onOpenSettings,
  onSenderChange,
  recipientErrors,
  selectedAccountId,
}: {
  accounts: MobileMailAccount[];
  draft: ComposerDraft<NativeComposerAttachment>;
  onChange: (field: ComposerFieldName, value: string) => void;
  onOpenSettings: () => void;
  onSenderChange: (accountId: string) => void;
  recipientErrors: Partial<RecipientFields<string>>;
  selectedAccountId: string | undefined;
}) {
  return (
    <View className="gap-4">
      <View className="gap-2">
        <ComposerSectionLabel>Delivery</ComposerSectionLabel>
        <View className="border-border border-y px-1">
          <ComposerSenderField
            accounts={accounts}
            onChange={onSenderChange}
            onOpenSettings={onOpenSettings}
            selectedAccountId={selectedAccountId}
          />
        </View>
      </View>
      <View className="gap-2">
        <ComposerSectionLabel>Recipients</ComposerSectionLabel>
        <PostalSurface className="overflow-hidden px-4">
          <ComposerField
            autoCapitalize="none"
            defaultValue={draft.to}
            keyboardType="email-address"
            label="To"
            error={recipientErrors.to}
            onChangeText={(value) => onChange("to", value)}
          />
          <ComposerField
            autoCapitalize="none"
            defaultValue={draft.cc}
            keyboardType="email-address"
            label="CC"
            error={recipientErrors.cc}
            onChangeText={(value) => onChange("cc", value)}
          />
          <ComposerField
            autoCapitalize="none"
            defaultValue={draft.bcc}
            divider={false}
            keyboardType="email-address"
            label="BCC"
            error={recipientErrors.bcc}
            onChangeText={(value) => onChange("bcc", value)}
          />
        </PostalSurface>
      </View>
    </View>
  );
}

function ComposerMessageSurface({
  autoFocus,
  draft,
  onChange,
  onRemoveAttachment,
}: {
  autoFocus: boolean;
  draft: ComposerDraft<NativeComposerAttachment>;
  onChange: (field: ComposerFieldName, value: string) => void;
  onRemoveAttachment: (attachment: NativeComposerAttachment) => void;
}) {
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");
  return (
    <View className="min-h-80 flex-1 gap-2">
      <ComposerSectionLabel>Message</ComposerSectionLabel>
      <PostalSurface className="min-h-72 flex-1 overflow-hidden px-4">
        <ComposerField
          defaultValue={draft.subject}
          label="Subject"
          onChangeText={(value) => onChange("subject", value)}
        />
        <View className="min-h-56 flex-1 py-4">
          <TextInput
            accessibilityLabel="Message body"
            autoFocus={autoFocus}
            className="text-foreground min-h-48 flex-1 text-base leading-6"
            defaultValue={draft.body}
            multiline
            placeholder="Write your message…"
            placeholderTextColor={mutedForeground}
            selectionColor={primary}
            style={{ color: foreground }}
            textAlignVertical="top"
            onChangeText={(value) => onChange("body", value)}
          />
          <ComposerAttachmentList
            attachments={draft.attachments}
            onRemove={onRemoveAttachment}
          />
        </View>
      </PostalSurface>
    </View>
  );
}
