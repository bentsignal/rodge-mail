import { useState } from "react";
import { Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { FieldGroup, Text, TextInput } from "@expo/ui";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { MobileMailAccount } from "~/features/mail/lib/convex-mail";
import { optimisticallyRemoveAccount } from "~/features/mail/account-removal-optimistic";
import { toConvexId } from "~/features/mail/lib/convex-id";
import { getAccountConnectionPresentation } from "~/features/mail/screens/account-connection-status";
import {
  useAccountReconnect,
  useAccountSyncRetry,
} from "~/features/mail/screens/use-account-recovery";
import { useMailStore } from "~/features/mail/store";
import { useColor } from "~/hooks/use-color";
import { NativeHost } from "./native-host";
import { ActionRow, ValueRow } from "./settings-rows";

const MAX_LABEL_LENGTH = 80;
const PROVIDER_NAMES = {
  gmail: "Gmail",
  hosted: "Hosted",
  icloud: "iCloud",
  microsoft: "Microsoft 365",
} as const;

export function AccountSettingsScreen({ accountId }: { accountId: string }) {
  const liveAccount = useMailStore((store) =>
    store.accounts.find((candidate) => candidate.id === accountId),
  );
  // Keeps the page drawn while it pops back after the account is removed.
  const [removedAccount, setRemovedAccount] = useState<MobileMailAccount>();
  const account = liveAccount ?? removedAccount;
  if (!account) return <Stack.Title>Account</Stack.Title>;
  return <AccountSettings account={account} onRemove={setRemovedAccount} />;
}

function AccountSettings({
  account,
  onRemove,
}: {
  account: MobileMailAccount;
  onRemove: (account: MobileMailAccount) => void;
}) {
  const connection = getAccountConnectionPresentation(account);
  // A direct child of FieldGroup: Android wraps a section returned from a
  // component in a second card.
  const recoverySection =
    connection.canReconnect || connection.canRetry ? (
      <FieldGroup.Section>
        <RecoveryRows account={account} canRetry={connection.canRetry} />
      </FieldGroup.Section>
    ) : null;
  return (
    <>
      <Stack.Title>{account.label}</Stack.Title>
      <NativeHost style={{ flex: 1 }}>
        <FieldGroup>
          <FieldGroup.Section>
            <ValueRow label="Address" value={account.address} />
            <ValueRow
              label="Provider"
              value={PROVIDER_NAMES[account.provider]}
            />
            <ValueRow label="Status" value={connection.label} />
            <FieldGroup.SectionFooter>
              <Text>{connection.detail}</Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
          <FieldGroup.Section title="Inbox Name">
            <InboxNameField account={account} />
          </FieldGroup.Section>
          {recoverySection}
          <FieldGroup.Section>
            <RemoveAccountRow account={account} onRemove={onRemove} />
          </FieldGroup.Section>
        </FieldGroup>
      </NativeHost>
    </>
  );
}

function InboxNameField({ account }: { account: MobileMailAccount }) {
  const setDisplayLabel = useMutation(
    api.accounts.mutations.setDisplayLabel,
  ).withOptimisticUpdate((store, { accountId, displayLabel }) => {
    const accounts = store.getQuery(api.accounts.queries.list, {});
    if (!accounts) return;
    store.setQuery(
      api.accounts.queries.list,
      {},
      accounts.map((candidate) =>
        candidate._id === accountId
          ? { ...candidate, displayLabel: displayLabel.trim() || undefined }
          : candidate,
      ),
    );
  });
  const [label, setLabel] = useState(account.displayLabel ?? "");
  const muted = useColor("muted-foreground");

  function save(value: string) {
    if (value.trim() === (account.displayLabel ?? "")) return;
    setDisplayLabel({
      accountId: toConvexId<"mailAccounts">(account.id),
      displayLabel: value,
    }).catch(() => undefined);
  }

  return (
    <TextInput
      autoCapitalize="words"
      defaultValue={label}
      maxLength={MAX_LABEL_LENGTH}
      placeholderTextColor={muted}
      placeholder={account.displayName ?? account.address}
      returnKeyType="done"
      onBlur={() => save(label)}
      onChangeText={setLabel}
      onSubmitEditing={save}
    />
  );
}

function RemoveAccountRow({
  account,
  onRemove,
}: {
  account: MobileMailAccount;
  onRemove: (account: MobileMailAccount) => void;
}) {
  const router = useRouter();
  const accountFilter = useMailStore((store) => store.accountFilter);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const removeAccount = useMutation(
    api.accounts.mutations.remove,
  ).withOptimisticUpdate(optimisticallyRemoveAccount);

  function remove() {
    onRemove(account);
    if (accountFilter === account.id) setAccountFilter("all");
    removeAccount({ accountId: toConvexId<"mailAccounts">(account.id) }).catch(
      () => Alert.alert("Couldn't Remove Account", "Try again in a moment."),
    );
    router.back();
  }

  function confirm() {
    Alert.alert("Remove Account?", getRemovalMessage(account), [
      { style: "cancel", text: "Cancel" },
      { onPress: remove, style: "destructive", text: "Remove" },
    ]);
  }

  return <ActionRow destructive label="Remove Account" onPress={confirm} />;
}

function getRemovalMessage(account: MobileMailAccount) {
  const removes = `Removes ${account.address} and its mail from Rodge Mail.`;
  if (account.provider === "hosted") {
    return `${removes} The address stops receiving mail.`;
  }
  return `${removes} Nothing is deleted from ${PROVIDER_NAMES[account.provider]}.`;
}

function RecoveryRows({
  account,
  canRetry,
}: {
  account: MobileMailAccount;
  canRetry: boolean;
}) {
  const reconnect = useAccountReconnect(account);
  const retry = useAccountSyncRetry(account);
  return (
    <>
      <RetrySyncRow
        isVisible={canRetry}
        retry={retry}
        onPress={reconnect.clearMessage}
      />
      <ActionRow
        disabled={reconnect.isReconnecting}
        icon="link"
        label="Reconnect"
        onPress={() => {
          retry.clearMessage();
          reconnect.start();
        }}
      />
      <ICloudPasswordRows reconnect={reconnect} onSubmit={retry.clearMessage} />
      <RecoveryMessage message={reconnect.message ?? retry.message} />
    </>
  );
}

function RetrySyncRow({
  isVisible,
  onPress,
  retry,
}: {
  isVisible: boolean;
  onPress: () => void;
  retry: ReturnType<typeof useAccountSyncRetry>;
}) {
  if (!isVisible) return null;
  return (
    <ActionRow
      disabled={retry.isRetrying}
      icon="arrow.clockwise"
      label="Try Sync Again"
      onPress={() => {
        onPress();
        void retry.retry();
      }}
    />
  );
}

function ICloudPasswordRows({
  onSubmit,
  reconnect,
}: {
  onSubmit: () => void;
  reconnect: ReturnType<typeof useAccountReconnect>;
}) {
  const muted = useColor("muted-foreground");
  if (!reconnect.showICloudForm) return null;
  return (
    <>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={muted}
        placeholder="App-specific password"
        secureTextEntry
        onChangeText={reconnect.setICloudPassword}
      />
      <ActionRow
        disabled={!reconnect.canSubmitICloud || reconnect.isReconnecting}
        label="Update Connection"
        onPress={() => {
          onSubmit();
          void reconnect.submitICloud();
        }}
      />
    </>
  );
}

function RecoveryMessage({ message }: { message: string | undefined }) {
  const muted = useColor("muted-foreground");
  if (!message) return null;
  return <Text textStyle={{ color: muted }}>{message}</Text>;
}
