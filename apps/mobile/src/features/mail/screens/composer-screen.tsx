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
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { Paperclip, Send, X } from "lucide-react-native";

import type { ComposerDraft } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";
import { useMailStore } from "../store";

export function ComposerScreen() {
  const params = useLocalSearchParams<{ subject?: string; to?: string }>();
  const router = useRouter();
  const accounts = useMailStore((store) => store.accounts);
  const enqueuePlainText = useMutation(api.mail.mutations.enqueuePlainText);
  const [idempotencyKey] = useState(() => `rodge-native-${randomUUID()}`);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft>({
    attachments: [],
    body: "",
    cc: "",
    subject: params.subject ?? "",
    to: params.to ?? "",
  });
  const canSend = draftCanSend(draft);

  function setField(field: keyof ComposerDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  async function send() {
    if (!canSend || isSending) return;
    if (draft.attachments.length > 0) {
      Alert.alert(
        "Attachments aren’t ready yet",
        "Remove the attachments to send this message as plain text.",
      );
      return;
    }
    const account = accounts.find(
      (item) => item.provider === "gmail" || item.provider === "microsoft",
    );
    if (!account) {
      Alert.alert(
        "Connect an account first",
        "Add Gmail or Microsoft 365 from Rodge Mail on the web before sending.",
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
        draft={draft}
        onAttach={() => void attachImages(setDraft)}
        onChange={setField}
        onRemoveAttachment={(name) => removeAttachment(setDraft, name)}
      />
    </KeyboardAvoidingView>
  );
}

async function attachImages(
  setDraft: React.Dispatch<React.SetStateAction<ComposerDraft>>,
) {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ["images"],
    selectionLimit: 5,
  });
  if (result.canceled) return;
  const attachments = result.assets.map(
    (asset, index) => asset.fileName ?? `Attachment ${index + 1}`,
  );
  setDraft((current) => ({
    ...current,
    attachments: [...current.attachments, ...attachments],
  }));
}

function removeAttachment(
  setDraft: React.Dispatch<React.SetStateAction<ComposerDraft>>,
  name: string,
) {
  setDraft((current) => ({
    ...current,
    attachments: current.attachments.filter(
      (attachment) => attachment !== name,
    ),
  }));
}

function ComposerBody({
  draft,
  onAttach,
  onChange,
  onRemoveAttachment,
}: {
  draft: ComposerDraft;
  onAttach: () => void;
  onChange: (field: keyof ComposerDraft, value: string) => void;
  onRemoveAttachment: (name: string) => void;
}) {
  return (
    <ScrollView
      contentContainerClassName="px-4 pb-10"
      keyboardShouldPersistTaps="handled"
    >
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
      <AttachmentList
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
        <Text className="text-foreground font-semibold">Attach files</Text>
      </Pressable>
    </ScrollView>
  );
}

function draftCanSend(draft: ComposerDraft) {
  return draft.to.trim().length > 0 && draft.body.trim().length > 0;
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

function AttachmentList({
  attachments,
  onRemove,
}: {
  attachments: string[];
  onRemove: (name: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <View className="mb-4 gap-2">
      {attachments.map((attachment) => (
        <View
          key={attachment}
          className="bg-muted flex-row items-center gap-2 rounded-xl px-3 py-2"
        >
          <Paperclip color="#777777" size={16} />
          <Text className="text-foreground min-w-0 flex-1" numberOfLines={1}>
            {attachment}
          </Text>
          <Pressable
            accessibilityLabel={`Remove ${attachment}`}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => onRemove(attachment)}
          >
            <X color="#777777" size={17} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
