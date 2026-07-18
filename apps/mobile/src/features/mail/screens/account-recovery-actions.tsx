import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { AccountConnectionPresentation } from "./account-connection-status";
import { useColor } from "~/hooks/use-color";
import {
  useAccountReconnect,
  useAccountSyncRetry,
} from "./use-account-recovery";

export function AccountRecoveryActions({
  account,
  connection,
}: {
  account: MobileMailAccount;
  connection: AccountConnectionPresentation;
}) {
  const reconnect = useAccountReconnect(account);
  const retry = useAccountSyncRetry(account);

  if (!connection.canReconnect && !connection.canRetry) return null;

  function startReconnect() {
    retry.clearMessage();
    reconnect.start();
  }

  function retrySync() {
    reconnect.clearMessage();
    void retry.retry();
  }

  function submitICloud() {
    retry.clearMessage();
    void reconnect.submitICloud();
  }

  return (
    <View className="gap-2 pt-1">
      <RecoveryButtons
        address={account.address}
        hasRetry={connection.canRetry}
        isReconnecting={reconnect.isReconnecting}
        isRetrying={retry.isRetrying}
        onReconnect={startReconnect}
        onRetry={retrySync}
      />
      <ICloudReconnectForm
        address={account.address}
        canSubmit={reconnect.canSubmitICloud}
        isLoading={reconnect.isReconnecting}
        isVisible={reconnect.showICloudForm}
        onPasswordChange={reconnect.setICloudPassword}
        onSubmit={submitICloud}
      />
      <RecoveryMessage message={reconnect.message ?? retry.message} />
    </View>
  );
}

function RecoveryButtons({
  address,
  hasRetry,
  isReconnecting,
  isRetrying,
  onReconnect,
  onRetry,
}: {
  address: string;
  hasRetry: boolean;
  isReconnecting: boolean;
  isRetrying: boolean;
  onReconnect: () => void;
  onRetry: () => void;
}) {
  return (
    <View className="flex-row gap-2">
      <RetryButton
        isLoading={isRetrying}
        isVisible={hasRetry}
        onPress={onRetry}
      />
      <ReconnectButton
        address={address}
        hasPrimaryAction={hasRetry}
        isDisabled={isReconnecting || isRetrying}
        isLoading={isReconnecting}
        onPress={onReconnect}
      />
    </View>
  );
}

function RetryButton({
  isLoading,
  isVisible,
  onPress,
}: {
  isLoading: boolean;
  isVisible: boolean;
  onPress: () => void;
}) {
  const primaryForeground = useColor("primary-foreground");
  if (!isVisible) return null;
  return (
    <Pressable
      accessibilityLabel="Try account sync again"
      accessibilityRole="button"
      className="bg-primary min-h-11 flex-1 items-center justify-center rounded-lg px-3 disabled:opacity-50"
      disabled={isLoading}
      onPress={onPress}
    >
      <LoadingButtonContent
        color={primaryForeground}
        isLoading={isLoading}
        label="Try sync"
        textClassName="text-primary-foreground font-semibold"
      />
    </Pressable>
  );
}

function ReconnectButton({
  address,
  hasPrimaryAction,
  isDisabled,
  isLoading,
  onPress,
}: {
  address: string;
  hasPrimaryAction: boolean;
  isDisabled: boolean;
  isLoading: boolean;
  onPress: () => void;
}) {
  const mutedForeground = useColor("muted-foreground");
  const primaryForeground = useColor("primary-foreground");
  const color = hasPrimaryAction ? mutedForeground : primaryForeground;
  const textClassName = hasPrimaryAction
    ? "text-foreground font-semibold"
    : "text-primary-foreground font-semibold";
  return (
    <Pressable
      accessibilityLabel={`Reconnect ${address}`}
      accessibilityRole="button"
      className={getReconnectButtonClassName(hasPrimaryAction)}
      disabled={isDisabled}
      onPress={onPress}
    >
      <LoadingButtonContent
        color={color}
        isLoading={isLoading}
        label="Reconnect"
        textClassName={textClassName}
      />
    </Pressable>
  );
}

function ICloudReconnectForm({
  address,
  canSubmit,
  isLoading,
  isVisible,
  onPasswordChange,
  onSubmit,
}: {
  address: string;
  canSubmit: boolean;
  isLoading: boolean;
  isVisible: boolean;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const mutedForeground = useColor("muted-foreground");
  const primaryForeground = useColor("primary-foreground");
  if (!isVisible) return null;
  return (
    <View className="bg-well gap-2 rounded-lg p-3">
      <Text className="text-foreground text-sm font-semibold">
        New app-specific password for {address}
      </Text>
      <TextInput
        accessibilityLabel={`App-specific password for ${address}`}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect={false}
        className="bg-paper border-paper-border text-foreground min-h-11 rounded-lg border px-3"
        defaultValue=""
        onChangeText={onPasswordChange}
        placeholder="xxxx-xxxx-xxxx-xxxx"
        placeholderTextColor={mutedForeground}
        secureTextEntry
      />
      <Pressable
        accessibilityRole="button"
        className="bg-primary min-h-11 items-center justify-center rounded-lg px-3 disabled:opacity-40"
        disabled={!canSubmit || isLoading}
        onPress={onSubmit}
      >
        <LoadingButtonContent
          color={primaryForeground}
          isLoading={isLoading}
          label="Update connection"
          textClassName="text-primary-foreground font-semibold"
        />
      </Pressable>
    </View>
  );
}

function LoadingButtonContent({
  color,
  isLoading,
  label,
  textClassName,
}: {
  color: string;
  isLoading: boolean;
  label: string;
  textClassName: string;
}) {
  if (isLoading) return <ActivityIndicator color={color} size="small" />;
  return <Text className={textClassName}>{label}</Text>;
}

function RecoveryMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      className="text-muted-foreground text-xs leading-4"
    >
      {message}
    </Text>
  );
}

function getReconnectButtonClassName(hasPrimaryAction: boolean) {
  if (hasPrimaryAction) {
    return "border-well-border min-h-11 flex-1 items-center justify-center rounded-lg border px-3 disabled:opacity-50";
  }
  return "bg-primary min-h-11 flex-1 items-center justify-center rounded-lg px-3 disabled:opacity-50";
}
