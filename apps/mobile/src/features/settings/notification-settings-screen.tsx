import { Alert, Platform } from "react-native";
import { FieldGroup, Picker, Row, Spacer, Switch, Text } from "@expo/ui";
import { frame } from "@expo/ui/swift-ui/modifiers";
import { useMutation, useQuery } from "convex/react";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import type { NotificationSetupState } from "~/features/notifications/notification-setup";
import {
  registerForNewMailNotifications,
  useNotificationSetupState,
} from "~/features/notifications/mobile-notifications";
import { isNotificationDeliveryEnabled } from "~/features/notifications/notification-setup";
import { NativeHost } from "./native-host";

const fillRow = Platform.OS === "ios" ? [frame({ maxWidth: Infinity })] : [];

const ACCOUNT_CHOICES = [
  { label: "Default", value: "inherit" },
  { label: "On", value: "on" },
  { label: "Off", value: "off" },
] as const;
type AccountChoice = (typeof ACCOUNT_CHOICES)[number]["value"];

export function NotificationSettingsScreen() {
  const preferences = useQuery(api.notifications.queries.getPreferences, {});
  const accountPreferences = useQuery(
    api.notifications.queries.listAccountPreferences,
    {},
  );
  const { setAccountPreferences, setPreferences } = useNotificationMutations();
  const { enableDevice, setupState } = useDeviceNotifications();

  if (!preferences || !accountPreferences) {
    return null;
  }
  const current = preferences;
  const deliveryEnabled =
    setupState !== undefined &&
    isNotificationDeliveryEnabled(current.newMailEnabled, setupState);

  function update(newMailEnabled: boolean, includePreview: boolean) {
    setPreferences({ includePreview, newMailEnabled }).catch(() =>
      Alert.alert("Couldn't Update Notifications"),
    );
  }

  async function setNewMail(value: boolean) {
    if (value && !(await enableDevice())) return;
    update(value, current.includePreview);
  }

  async function setAccountChoice(
    accountId: Id<"mailAccounts">,
    includePreview: boolean | null,
    choice: AccountChoice,
  ) {
    const newMailEnabled = choice === "inherit" ? null : choice === "on";
    const willEnable = newMailEnabled ?? current.newMailEnabled;
    if (willEnable && setupState !== "ready" && !(await enableDevice())) {
      return;
    }
    setAccountPreferences({ accountId, includePreview, newMailEnabled }).catch(
      () => Alert.alert("Couldn't Update This Account"),
    );
  }

  // A direct child of FieldGroup: Android wraps a section returned from a
  // component in a second card.
  const accountsSection =
    accountPreferences.length > 0 ? (
      <FieldGroup.Section title="Accounts">
        {accountPreferences.map((preference) => (
          <AccountNotificationRow
            key={preference.accountId}
            label={
              preference.displayLabel ??
              preference.displayName ??
              preference.address
            }
            value={toChoice(preference.override.newMailEnabled)}
            onChange={(choice) =>
              void setAccountChoice(
                preference.accountId,
                preference.override.includePreview,
                choice,
              )
            }
          />
        ))}
      </FieldGroup.Section>
    ) : null;

  return (
    <NativeHost style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section>
          <Switch
            disabled={setupState === undefined}
            label="New Mail"
            value={deliveryEnabled}
            onValueChange={(value) => void setNewMail(value)}
          />
          <Switch
            disabled={!deliveryEnabled}
            label="Show Previews"
            value={current.includePreview}
            onValueChange={(value) => update(current.newMailEnabled, value)}
          />
          {getSetupFooter(setupState)}
        </FieldGroup.Section>
        {accountsSection}
      </FieldGroup>
    </NativeHost>
  );
}

function useDeviceNotifications() {
  const registerPushToken = useMutation(
    api.notifications.mutations.registerPushToken,
  );
  const { refresh, setupState } = useNotificationSetupState();

  // Turning alerts on asks iOS for permission first; only it can answer.
  async function enableDevice() {
    try {
      const result = await registerForNewMailNotifications(registerPushToken);
      const nextState = await refresh();
      if (result.kind === "denied" || nextState === "permission-denied") {
        Alert.alert(
          "Notifications Are Off",
          "Allow notifications for Rodge Mail in Settings.",
        );
        return false;
      }
      if (result.kind === "simulator" || nextState === "unsupported") {
        Alert.alert("Notifications need a physical device.");
        return false;
      }
      return nextState === "ready";
    } catch {
      Alert.alert("Couldn't Turn On Notifications");
      return false;
    }
  }

  return { enableDevice, setupState };
}

function useNotificationMutations() {
  const setPreferences = useMutation(
    api.notifications.mutations.setPreferences,
  ).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(
      api.notifications.queries.getPreferences,
      {},
    );
    if (!current) return;
    store.setQuery(
      api.notifications.queries.getPreferences,
      {},
      {
        ...current,
        ...args,
      },
    );
  });
  const setAccountPreferences = useMutation(
    api.notifications.mutations.setAccountPreferences,
  ).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(
      api.notifications.queries.listAccountPreferences,
      {},
    );
    if (!current) return;
    store.setQuery(
      api.notifications.queries.listAccountPreferences,
      {},
      current.map((preference) =>
        preference.accountId === args.accountId
          ? {
              ...preference,
              override: {
                includePreview: args.includePreview,
                newMailEnabled: args.newMailEnabled,
              },
            }
          : preference,
      ),
    );
  });
  return { setAccountPreferences, setPreferences };
}

function getSetupFooter(setupState: NotificationSetupState | undefined) {
  if (setupState === "permission-denied") {
    return (
      <FieldGroup.SectionFooter>
        <Text>Notifications are off for Rodge Mail in Settings.</Text>
      </FieldGroup.SectionFooter>
    );
  }
  if (setupState === "unsupported") {
    return (
      <FieldGroup.SectionFooter>
        <Text>Notifications need a physical device.</Text>
      </FieldGroup.SectionFooter>
    );
  }
  return null;
}

function toChoice(newMailEnabled: boolean | null) {
  if (newMailEnabled === null) return "inherit" as const;
  return newMailEnabled ? ("on" as const) : ("off" as const);
}

function AccountNotificationRow({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (choice: AccountChoice) => void;
  value: AccountChoice;
}) {
  return (
    <Row alignment="center" modifiers={fillRow}>
      <Text numberOfLines={1}>{label}</Text>
      <Spacer />
      <Picker selectedValue={value} onValueChange={onChange}>
        {ACCOUNT_CHOICES.map((choice) => (
          <Picker.Item
            key={choice.value}
            label={choice.label}
            value={choice.value}
          />
        ))}
      </Picker>
    </Row>
  );
}
