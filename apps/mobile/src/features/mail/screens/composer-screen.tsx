import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Paperclip, Send, X } from "lucide-react-native";

import type { ComposerDraft } from "@rodge-mail/features/mail";

import { useColor } from "~/hooks/use-color";

export function ComposerScreen() {
  const params = useLocalSearchParams<{ subject?: string; to?: string }>();
  const router = useRouter();
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

  async function attachImages() {
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

  function removeAttachment(name: string) {
    setDraft((current) => ({
      ...current,
      attachments: current.attachments.filter(
        (attachment) => attachment !== name,
      ),
    }));
  }

  function send() {
    if (!canSend) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ComposerHeader canSend={canSend} onCancel={router.back} onSend={send} />
      <ScrollView
        contentContainerClassName="px-4 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <ComposerField
          autoCapitalize="none"
          defaultValue={draft.to}
          keyboardType="email-address"
          label="To"
          onChangeText={(value) => setField("to", value)}
        />
        <ComposerField
          autoCapitalize="none"
          defaultValue={draft.cc}
          keyboardType="email-address"
          label="CC"
          onChangeText={(value) => setField("cc", value)}
        />
        <ComposerField
          defaultValue={draft.subject}
          label="Subject"
          onChangeText={(value) => setField("subject", value)}
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
          onChangeText={(value) => setField("body", value)}
        />
        <AttachmentList
          attachments={draft.attachments}
          onRemove={removeAttachment}
        />
        <Pressable
          accessibilityLabel="Attach photos"
          accessibilityRole="button"
          className="border-border flex-row items-center justify-center gap-2 rounded-xl border py-3"
          onPress={() => void attachImages()}
        >
          <Paperclip color="#777777" size={18} />
          <Text className="text-foreground font-semibold">Attach files</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function draftCanSend(draft: ComposerDraft) {
  return (
    draft.to.trim().length > 0 &&
    (draft.subject.trim().length > 0 || draft.body.trim().length > 0)
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
