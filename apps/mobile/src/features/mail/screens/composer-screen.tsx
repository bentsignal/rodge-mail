import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";

import type { ComposerDraft, RecipientFields } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { ComposerFieldName } from "./composer-helpers";
import type { NativeComposerAttachment } from "./use-native-attachments";
import { useColor } from "~/hooks/use-color";
import { useMailStore } from "../store";
import { ComposerAttachmentList } from "./composer-attachment-list";
import { ComposerRow, ComposerTextField } from "./composer-field";
import {
  canSendFromAccount,
  createComposerDraft,
  getSelectedAccount,
} from "./composer-helpers";
import { ComposerNavigationHeader } from "./composer-navigation-header";
import { ComposerRecipientField } from "./composer-recipient-field";
import { ComposerSenderField, SenderPicker } from "./composer-sender-field";
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

  function setField(field: ComposerFieldName, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <View style={{ backgroundColor, flex: 1 }}>
      <ComposerNavigationHeader
        canSend={canSend}
        title={draft.subject.trim() || "New Message"}
        variant={variant}
        onAttachFiles={() => void attachFiles()}
        onAttachPhotos={() => void attachImages()}
        onCancel={router.back}
        onSend={send}
      />
      <ComposerBody
        key={idempotencyKey}
        accounts={sendingAccounts}
        draft={draft}
        focus={getInitialFocus(variant, params.to)}
        recipientErrors={recipientErrors}
        selectedAccount={selectedAccount}
        onChange={setField}
        onOpenSettings={() => router.navigate("/(tabs)/(settings)")}
        onRemoveAttachment={(attachment) => void removeAttachment(attachment)}
        onSenderChange={setSelectedAccountId}
      />
    </View>
  );
}

function getInitialFocus(variant: "modal" | "tab", to: string | undefined) {
  if (variant === "tab") return undefined;
  return to ? "body" : "to";
}

function ComposerBody({
  accounts,
  draft,
  focus,
  onChange,
  onOpenSettings,
  onRemoveAttachment,
  onSenderChange,
  recipientErrors,
  selectedAccount,
}: {
  accounts: MobileMailAccount[];
  draft: ComposerDraft<NativeComposerAttachment>;
  focus: "body" | "to" | undefined;
  onChange: (field: ComposerFieldName, value: string) => void;
  onOpenSettings: () => void;
  onRemoveAttachment: (attachment: NativeComposerAttachment) => void;
  onSenderChange: (accountId: string) => void;
  recipientErrors: Partial<RecipientFields<string>>;
  selectedAccount: MobileMailAccount | undefined;
}) {
  const headerHeight = useHeaderHeight();
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");

  return (
    // Not flattened: the form sheet lays out a ScrollView that is its direct child itself.
    <View className="min-h-0 flex-1" collapsable={false}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ height: headerHeight }} />
        <ComposerRecipientField
          autoFocus={focus === "to"}
          defaultValue={draft.to}
          error={recipientErrors.to}
          label="To"
          onChange={(value) => onChange("to", value)}
        />
        <CopiesAndSender
          accounts={accounts}
          draft={draft}
          recipientErrors={recipientErrors}
          selectedAccount={selectedAccount}
          onChange={onChange}
          onOpenSettings={onOpenSettings}
          onSenderChange={onSenderChange}
        />
        <ComposerTextField
          defaultValue={draft.subject}
          label="Subject"
          returnKeyType="next"
          testID="composer-subject-field"
          onChangeText={(value) => onChange("subject", value)}
        />
        <ComposerAttachmentList
          attachments={draft.attachments}
          onRemove={onRemoveAttachment}
        />
        <TextInput
          accessibilityLabel="Message body"
          autoFocus={focus === "body"}
          className="text-foreground flex-1 px-4 pt-3 text-base leading-6"
          defaultValue={draft.body}
          multiline
          scrollEnabled={false}
          selectionColor={primary}
          style={{ color: foreground, minHeight: 240 }}
          testID="composer-body-field"
          textAlignVertical="top"
          placeholderTextColor={mutedForeground}
          onChangeText={(value) => onChange("body", value)}
        />
      </ScrollView>
    </View>
  );
}

/** Cc, Bcc, and From fold into one row until Cc/Bcc is tapped, like Mail. */
function CopiesAndSender({
  accounts,
  draft,
  onChange,
  onOpenSettings,
  onSenderChange,
  recipientErrors,
  selectedAccount,
}: {
  accounts: MobileMailAccount[];
  draft: ComposerDraft<NativeComposerAttachment>;
  onChange: (field: ComposerFieldName, value: string) => void;
  onOpenSettings: () => void;
  onSenderChange: (accountId: string) => void;
  recipientErrors: Partial<RecipientFields<string>>;
  selectedAccount: MobileMailAccount | undefined;
}) {
  const [expanded, setExpanded] = useState(
    () => draft.cc.trim().length > 0 || draft.bcc.trim().length > 0,
  );
  const [focusCopies, setFocusCopies] = useState(false);

  function expand() {
    setExpanded(true);
    setFocusCopies(true);
  }

  if (!expanded && selectedAccount && accounts.length > 1) {
    return (
      <ComposerRow>
        <Pressable
          accessibilityHint="Shows the Cc and Bcc fields"
          accessibilityLabel="Cc/Bcc"
          accessibilityRole="button"
          className="min-h-8 justify-center"
          hitSlop={{ bottom: 6, top: 6 }}
          testID="composer-copies-row"
          onPress={expand}
        >
          <Text className="text-muted-foreground text-base">Cc/Bcc, From:</Text>
        </Pressable>
        <SenderPicker
          muted
          accounts={accounts}
          selectedAccount={selectedAccount}
          onChange={onSenderChange}
        />
      </ComposerRow>
    );
  }

  if (!expanded) {
    const summary = selectedAccount
      ? `Cc/Bcc, From: ${selectedAccount.address}`
      : "Cc/Bcc";
    return (
      <Pressable
        accessibilityHint="Shows the Cc and Bcc fields"
        accessibilityRole="button"
        testID="composer-copies-row"
        onPress={expand}
      >
        <ComposerRow>
          <Text className="text-muted-foreground text-base" numberOfLines={1}>
            {summary}
          </Text>
        </ComposerRow>
      </Pressable>
    );
  }

  return (
    <>
      <ComposerRecipientField
        autoFocus={focusCopies}
        defaultValue={draft.cc}
        error={recipientErrors.cc}
        label="Cc"
        onChange={(value) => onChange("cc", value)}
      />
      <ComposerRecipientField
        defaultValue={draft.bcc}
        error={recipientErrors.bcc}
        label="Bcc"
        onChange={(value) => onChange("bcc", value)}
      />
      <ComposerSenderField
        accounts={accounts}
        selectedAccount={selectedAccount}
        onChange={onSenderChange}
        onOpenSettings={onOpenSettings}
      />
    </>
  );
}
