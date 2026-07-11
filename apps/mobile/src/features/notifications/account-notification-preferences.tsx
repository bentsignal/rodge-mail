import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { NotificationSetupState } from "./notification-setup";

const options = [
  { label: "Inherit", value: null },
  { label: "On", value: true },
  { label: "Off", value: false },
] as const;

export function AccountNotificationPreferences({
  globalNewMailEnabled,
  onEnableDevice,
  setupState,
}: {
  globalNewMailEnabled: boolean;
  onEnableDevice: () => Promise<boolean>;
  setupState: NotificationSetupState | undefined;
}) {
  const preferences = useQuery(
    api.notifications.queries.listAccountPreferences,
    {},
  );
  const setAccountPreferences = useMutation(
    api.notifications.mutations.setAccountPreferences,
  );
  const [savingAccountId, setSavingAccountId] = useState<string>();
  const [message, setMessage] = useState<string>();

  if (!preferences) {
    return (
      <View className="items-center py-5">
        <ActivityIndicator color="#d77a55" />
      </View>
    );
  }
  if (preferences.length === 0) return null;

  async function update(
    preference: NonNullable<typeof preferences>[number],
    newMailEnabled: boolean | null,
  ) {
    setSavingAccountId(preference.accountId);
    setMessage(undefined);
    try {
      const willEnable = newMailEnabled ?? globalNewMailEnabled;
      if (willEnable && setupState !== "ready" && !(await onEnableDevice())) {
        setMessage("Set up notifications on this device first.");
        setSavingAccountId(undefined);
        return;
      }
      await setAccountPreferences({
        accountId: preference.accountId,
        includePreview: preference.override.includePreview,
        newMailEnabled,
      });
    } catch {
      setMessage("Could not update this account.");
    }
    setSavingAccountId(undefined);
  }

  return (
    <View className="border-border border-t px-4 py-4">
      <Text className="text-foreground font-semibold">Accounts</Text>
      <Text className="text-muted-foreground mt-1 text-sm leading-5">
        Override new mail alerts for individual accounts.
      </Text>
      <AccountSetupMessage setupState={setupState} />
      <View className="mt-4 gap-4">
        {preferences.map((preference) => (
          <View key={preference.accountId} className="gap-2">
            <View>
              <Text className="text-foreground font-medium" numberOfLines={1}>
                {preference.displayName ?? preference.address}
              </Text>
              <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                {preference.address}
              </Text>
            </View>
            <View className="bg-background flex-row rounded-lg p-1">
              {options.map((option) => (
                <PreferenceOption
                  key={option.label}
                  disabled={savingAccountId === preference.accountId}
                  label={option.label}
                  selected={preference.override.newMailEnabled === option.value}
                  onPress={() => void update(preference, option.value)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      <PreferenceMessage message={message} />
    </View>
  );
}

function AccountSetupMessage({
  setupState,
}: {
  setupState: NotificationSetupState | undefined;
}) {
  if (setupState === undefined || setupState === "ready") return null;
  return (
    <Text className="text-muted-foreground mt-1 text-xs leading-4">
      These preferences cannot deliver alerts until this device is set up.
    </Text>
  );
}

function PreferenceOption({
  disabled,
  label,
  onPress,
  selected,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-1 items-center rounded-md px-2 py-2 disabled:opacity-50 ${
        selected ? "bg-primary" : ""
      }`}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        className={`text-xs font-semibold ${
          selected ? "text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PreferenceMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <Text className="text-destructive mt-3 text-sm">{message}</Text>;
}
