import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Host, Switch } from "@expo/ui";
import { useMutation, useQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { NotificationSetupState } from "./notification-setup";
import { useResolvedMobileColorScheme } from "~/features/theme/mobile-theme";
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
  const colorScheme = useResolvedMobileColorScheme();
  const primary = useColor("primary");

  return (
    <View className="border-border gap-1 border-b px-4 py-3 last:border-b-0">
      <Host
        colorScheme={colorScheme}
        matchContents={{ vertical: true }}
        seedColor={primary}
        style={{ width: "100%" }}
      >
        <Switch
          disabled={disabled}
          label={label}
          testID={`notification-${label.toLowerCase().replaceAll(" ", "-")}`}
          value={value}
          onValueChange={onChange}
        />
      </Host>
      <Text className="text-muted-foreground text-sm leading-5">
        {description}
      </Text>
    </View>
  );
}

function PreferenceMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <Text className="text-destructive px-4 py-3 text-sm">{message}</Text>;
}
