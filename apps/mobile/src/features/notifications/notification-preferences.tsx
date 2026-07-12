import { useState } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { NotificationSetupState } from "./notification-setup";
import { useColor } from "~/hooks/use-color";
import { AccountNotificationPreferences } from "./account-notification-preferences";
import {
  registerForNewMailNotifications,
  useNotificationSetupState,
} from "./mobile-notifications";
import { isNotificationDeliveryEnabled } from "./notification-setup";

export function NotificationPreferences() {
  const primary = useColor("primary");
  const preferences = useQuery(api.notifications.queries.getPreferences, {});
  const setPreferences = useMutation(
    api.notifications.mutations.setPreferences,
  );
  const registerPushToken = useMutation(
    api.notifications.mutations.registerPushToken,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const { refresh, setupState } = useNotificationSetupState();

  if (!preferences) {
    return (
      <View className="items-center py-5">
        <ActivityIndicator color={primary} />
      </View>
    );
  }
  const currentPreferences = preferences;
  const deliveryEnabled =
    setupState !== undefined &&
    isNotificationDeliveryEnabled(
      currentPreferences.newMailEnabled,
      setupState,
    );

  async function update(newMailEnabled: boolean, includePreview: boolean) {
    setIsSaving(true);
    setMessage(undefined);
    try {
      await setPreferences({ includePreview, newMailEnabled });
    } catch {
      setMessage("Could not update notification settings.");
    }
    setIsSaving(false);
  }

  async function setNewMailEnabled(value: boolean) {
    if (value && !(await enableDevice())) return;
    await update(value, currentPreferences.includePreview);
  }

  async function enableDevice() {
    setIsSaving(true);
    setMessage(undefined);
    try {
      const result = await registerForNewMailNotifications(registerPushToken);
      const nextState = await refresh();
      if (result.kind === "denied" || nextState === "permission-denied") {
        setMessage("Allow notifications in system settings first.");
        setIsSaving(false);
        return false;
      }
      if (result.kind === "simulator" || nextState === "unsupported") {
        setMessage("Remote notifications require a physical device.");
        setIsSaving(false);
        return false;
      }
      setIsSaving(false);
      return nextState === "ready";
    } catch {
      setMessage("Could not enable notifications on this device.");
      setIsSaving(false);
      return false;
    }
  }

  return (
    <>
      <NotificationToggle
        description={getSetupDescription(setupState)}
        disabled={isSaving || setupState === undefined}
        label="New mail"
        value={deliveryEnabled}
        onChange={(value) => void setNewMailEnabled(value)}
      />
      <NotificationToggle
        description="Include the sender and subject."
        disabled={isSaving || !deliveryEnabled}
        label="Show preview"
        value={currentPreferences.includePreview}
        onChange={(value) =>
          void update(currentPreferences.newMailEnabled, value)
        }
      />
      <PreferenceMessage message={message} />
      <AccountNotificationPreferences
        globalNewMailEnabled={currentPreferences.newMailEnabled}
        setupState={setupState}
        onEnableDevice={enableDevice}
      />
    </>
  );
}

function getSetupDescription(setupState: NotificationSetupState | undefined) {
  if (setupState === undefined) return "Checking this device…";
  if (setupState === "permission-denied") {
    return "Blocked in system settings. Tap after allowing notifications.";
  }
  if (setupState === "setup-required") {
    return "Tap to allow notifications and register this device.";
  }
  if (setupState === "unsupported") {
    return "Remote notifications require a physical device.";
  }
  return "This device is ready for newly received mail alerts.";
}

function NotificationToggle({
  description,
  disabled,
  label,
  onChange,
  value,
}: {
  description: string;
  disabled: boolean;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View className="border-border flex-row items-center gap-4 border-b px-4 py-3 last:border-b-0">
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-foreground font-semibold">{label}</Text>
        <Text className="text-muted-foreground text-sm leading-5">
          {description}
        </Text>
      </View>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}

function PreferenceMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <Text className="text-destructive px-4 py-3 text-sm">{message}</Text>;
}
