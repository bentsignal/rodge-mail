import { useState } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import { registerForNewMailNotifications } from "./mobile-notifications";

export function NotificationPreferences() {
  const preferences = useQuery(api.notifications.queries.getPreferences, {});
  const setPreferences = useMutation(
    api.notifications.mutations.setPreferences,
  );
  const registerPushToken = useMutation(
    api.notifications.mutations.registerPushToken,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  if (!preferences) {
    return (
      <View className="items-center py-5">
        <ActivityIndicator color="#d77a55" />
      </View>
    );
  }
  const currentPreferences = preferences;

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
    if (value) {
      setIsSaving(true);
      setMessage(undefined);
      try {
        const result = await registerForNewMailNotifications(registerPushToken);
        if (result.kind === "denied") {
          setMessage("Allow notifications in system settings first.");
          setIsSaving(false);
          return;
        }
      } catch {
        setMessage("Could not enable notifications on this device.");
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }
    await update(value, currentPreferences.includePreview);
  }

  return (
    <>
      <NotificationToggle
        description="Alerts for newly received mail."
        disabled={isSaving}
        label="New mail"
        value={currentPreferences.newMailEnabled}
        onChange={(value) => void setNewMailEnabled(value)}
      />
      <NotificationToggle
        description="Include the sender and subject."
        disabled={isSaving || !currentPreferences.newMailEnabled}
        label="Show preview"
        value={currentPreferences.includePreview}
        onChange={(value) =>
          void update(currentPreferences.newMailEnabled, value)
        }
      />
      <PreferenceMessage message={message} />
    </>
  );
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
