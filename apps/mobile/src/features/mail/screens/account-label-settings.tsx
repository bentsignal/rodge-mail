import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { MobileMailAccount } from "../lib/convex-mail";
import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";

const MAX_LABEL_LENGTH = 80;

export function AccountLabelSettings({
  accounts,
}: {
  accounts: MobileMailAccount[];
}) {
  if (accounts.length === 0) {
    return (
      <Text className="text-muted-foreground px-4 py-4 text-sm">
        Connect an account to name it.
      </Text>
    );
  }

  return accounts.map((account) => (
    <AccountLabelForm account={account} key={account.id} />
  ));
}

function AccountLabelForm({ account }: { account: MobileMailAccount }) {
  const foreground = useColor("foreground");
  const setDisplayLabel = useMutation(api.accounts.mutations.setDisplayLabel);
  const [label, setLabel] = useState(account.displayLabel ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const identity = account.displayName?.trim();

  async function save() {
    setIsSaving(true);
    setMessage(undefined);
    try {
      await setDisplayLabel({
        accountId: toConvexId<"mailAccounts">(account.id),
        displayLabel: label,
      });
      setMessage(label.trim() ? "Name saved." : "Name reset.");
    } catch {
      setMessage("Could not save this name.");
    }
    setIsSaving(false);
  }

  return (
    <View className="border-well-border gap-2 border-b px-4 py-3.5 last:border-b-0">
      <View className="flex-row items-center gap-3">
        <View
          className="border-brass/50 size-10 items-center justify-center rounded-full border"
          style={{ backgroundColor: account.accent }}
        >
          <Text className="font-bold text-white">{account.initials}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-foreground font-semibold" numberOfLines={1}>
            {account.label}
          </Text>
          <Text className="text-muted-foreground text-sm" numberOfLines={1}>
            {getAccountIdentity(account.provider, identity, account.address)}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <TextInput
          accessibilityLabel={`Display name for ${account.address}`}
          autoCapitalize="words"
          className="bg-well border-well-border text-foreground h-10 min-w-0 flex-1 rounded-lg border px-3"
          maxLength={MAX_LABEL_LENGTH}
          onChangeText={setLabel}
          placeholder={identity ?? account.address}
          placeholderTextColor={`${foreground}80`}
          returnKeyType="done"
          defaultValue={label}
          onSubmitEditing={() => void save()}
        />
        <Pressable
          accessibilityLabel={`Save display name for ${account.address}`}
          accessibilityRole="button"
          className="bg-primary h-10 min-w-16 items-center justify-center rounded-lg px-3 disabled:opacity-50"
          disabled={isSaving}
          onPress={() => void save()}
        >
          <SaveButtonContent isSaving={isSaving} />
        </Pressable>
      </View>
      <SaveMessage message={message} />
    </View>
  );
}

function SaveButtonContent({ isSaving }: { isSaving: boolean }) {
  if (isSaving) return <ActivityIndicator color="white" size="small" />;
  return <Text className="font-semibold text-white">Save</Text>;
}

function SaveMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <Text className="text-muted-foreground text-xs">{message}</Text>;
}

function getAccountIdentity(
  provider: MobileMailAccount["provider"],
  identity: string | undefined,
  address: string,
) {
  const providerLabel =
    provider === "gmail"
      ? "Gmail"
      : provider === "icloud"
        ? "iCloud"
        : "Microsoft 365";
  if (identity && identity !== address) {
    return `${providerLabel} · ${identity} · ${address}`;
  }
  return `${providerLabel} · ${address}`;
}
