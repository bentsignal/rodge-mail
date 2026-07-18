import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { Check, TriangleAlert } from "lucide-react-native";

import { api } from "@rodge-mail/convex/api";

import type { MobileMailAccount } from "../lib/convex-mail";
import { useColor } from "~/hooks/use-color";
import { toConvexId } from "../lib/convex-id";
import { getAccountConnectionPresentation } from "./account-connection-status";
import { AccountRecoveryActions } from "./account-recovery-actions";

const MAX_LABEL_LENGTH = 80;
type SaveStatus = "idle" | "saving" | "success" | "error";

export function AccountLabelSettings({
  accounts,
}: {
  accounts: MobileMailAccount[];
}) {
  if (accounts.length === 0) {
    return (
      <Text className="text-muted-foreground px-4 py-4 text-sm">
        No mail accounts are connected yet.
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const identity = account.displayName?.trim();
  const connection = getAccountConnectionPresentation(account);

  async function save() {
    clearTimeout(resetTimer.current);
    setSaveStatus("saving");
    try {
      await setDisplayLabel({
        accountId: toConvexId<"mailAccounts">(account.id),
        displayLabel: label,
      });
      setSaveStatus("success");
    } catch {
      setSaveStatus("error");
    }
    resetTimer.current = setTimeout(() => setSaveStatus("idle"), 1800);
  }

  return (
    <View className="border-well-border gap-3 border-b px-4 py-4 last:border-b-0">
      <View className="flex-row items-start gap-3">
        <View
          className="border-brass/50 size-10 items-center justify-center rounded-full border"
          style={{ backgroundColor: account.accent }}
        >
          <Text className="font-bold text-white">{account.initials}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className="text-foreground min-w-0 flex-1 font-semibold"
              numberOfLines={1}
            >
              {account.label}
            </Text>
            <ConnectionBadge label={connection.label} tone={connection.tone} />
          </View>
          <Text className="text-muted-foreground text-sm" numberOfLines={1}>
            {getAccountIdentity(account.provider, identity, account.address)}
          </Text>
        </View>
      </View>
      <Text
        accessibilityLiveRegion="polite"
        className={getConnectionDetailClassName(connection.tone)}
      >
        {connection.detail}
      </Text>
      <AccountRecoveryActions account={account} connection={connection} />
      <Text className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Inbox name
      </Text>
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
          accessibilityLabel={`${getSaveStatusLabel(saveStatus)} for ${account.address}`}
          accessibilityLiveRegion="polite"
          accessibilityRole="button"
          className="bg-primary h-10 w-16 items-center justify-center rounded-lg px-3 disabled:opacity-70"
          disabled={saveStatus === "saving"}
          onPress={() => void save()}
        >
          <SaveButtonContent status={saveStatus} />
        </Pressable>
      </View>
    </View>
  );
}

function ConnectionBadge({
  label,
  tone,
}: {
  label: string;
  tone: ReturnType<typeof getAccountConnectionPresentation>["tone"];
}) {
  return (
    <View className={getConnectionBadgeClassName(tone)}>
      <Text className={getConnectionBadgeTextClassName(tone)}>{label}</Text>
    </View>
  );
}

function getConnectionBadgeClassName(
  tone: ReturnType<typeof getAccountConnectionPresentation>["tone"],
) {
  if (tone === "danger") return "bg-destructive/15 rounded-full px-2 py-1";
  if (tone === "warning") return "bg-brass/15 rounded-full px-2 py-1";
  if (tone === "healthy") return "bg-primary/15 rounded-full px-2 py-1";
  return "bg-well rounded-full px-2 py-1";
}

function getConnectionBadgeTextClassName(
  tone: ReturnType<typeof getAccountConnectionPresentation>["tone"],
) {
  const base = "text-[10px] font-bold tracking-wide uppercase";
  if (tone === "danger") return `${base} text-destructive`;
  if (tone === "warning") return `${base} text-brass`;
  if (tone === "healthy") return `${base} text-primary`;
  return `${base} text-muted-foreground`;
}

function getConnectionDetailClassName(
  tone: ReturnType<typeof getAccountConnectionPresentation>["tone"],
) {
  if (tone === "danger") return "text-destructive text-sm leading-5";
  return "text-muted-foreground text-sm leading-5";
}

function SaveButtonContent({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return <ActivityIndicator color="white" size="small" />;
  }
  if (status === "success") return <Check color="white" size={18} />;
  if (status === "error") return <TriangleAlert color="white" size={18} />;
  return <Text className="font-semibold text-white">Save</Text>;
}

function getSaveStatusLabel(status: SaveStatus) {
  if (status === "saving") return "Saving display name";
  if (status === "success") return "Display name saved";
  if (status === "error") return "Display name could not be saved";
  return "Save display name";
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
