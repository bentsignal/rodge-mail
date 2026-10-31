import { useState } from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { FieldGroup, Picker, Row, Spacer, Text } from "@expo/ui";
import { frame } from "@expo/ui/swift-ui/modifiers";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { MobileThemeMode } from "~/features/theme/mobile-theme";
import { authClient } from "~/features/auth/client";
import { retryTransientPasskeyAssociation } from "~/features/auth/native-passkey-operation";
import { useMailStore } from "~/features/mail/store";
import {
  registerForNewMailNotifications,
  scheduleLocalNotificationPreview,
  unregisterCurrentPushToken,
} from "~/features/notifications/mobile-notifications";
import {
  setMobileThemeMode,
  useMobileAppearance,
} from "~/features/theme/mobile-theme";
import { NativeHost } from "./native-host";
import { ActionRow, NavigationRow } from "./settings-rows";

const fillRow = Platform.OS === "ios" ? [frame({ maxWidth: Infinity })] : [];

const PROVIDER_ICONS = {
  gmail: "envelope",
  hosted: "at",
  icloud: "icloud",
  microsoft: "briefcase",
} as const;

const APPEARANCE_MODES = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const satisfies readonly { label: string; value: MobileThemeMode }[];

export function SettingsScreen() {
  const router = useRouter();
  const accounts = useMailStore((store) => store.accounts);
  // Sections stay direct children of FieldGroup: Android wraps a section
  // returned from a component in a second card.
  const developerSection = __DEV__ ? (
    <FieldGroup.Section title="Developer">
      <SeedMailRow />
      <NotificationPreviewRow />
    </FieldGroup.Section>
  ) : null;

  return (
    <NativeHost style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section title="Accounts">
          {accounts.map((account) => (
            <NavigationRow
              key={account.id}
              icon={PROVIDER_ICONS[account.provider]}
              label={account.label}
              value={account.address}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/(settings)/account/[id]",
                  params: { id: account.id },
                })
              }
            />
          ))}
          <NavigationRow
            icon="plus.circle"
            label="Add Account"
            onPress={() => router.push("/(tabs)/(settings)/add-account")}
          />
        </FieldGroup.Section>
        <FieldGroup.Section>
          <AppearanceRow />
          <NavigationRow
            icon="bell"
            label="Notifications"
            onPress={() => router.push("/(tabs)/(settings)/notifications")}
          />
        </FieldGroup.Section>
        <FieldGroup.Section>
          <AddPasskeyRow />
          <SignOutRow />
        </FieldGroup.Section>
        {developerSection}
      </FieldGroup>
    </NativeHost>
  );
}

function AppearanceRow() {
  const appearance = useMobileAppearance();
  return (
    <Row alignment="center" modifiers={fillRow}>
      <Text>Appearance</Text>
      <Spacer />
      <Picker
        selectedValue={appearance.mode}
        onValueChange={(mode: MobileThemeMode) =>
          void setMobileThemeMode(mode).catch(() => undefined)
        }
      >
        {APPEARANCE_MODES.map((mode) => (
          <Picker.Item key={mode.value} label={mode.label} value={mode.value} />
        ))}
      </Picker>
    </Row>
  );
}

function AddPasskeyRow() {
  const [isAdding, setIsAdding] = useState(false);

  // The passkey sheet is the system's; nothing can show before it answers.
  async function addPasskey() {
    setIsAdding(true);
    const result = await retryTransientPasskeyAssociation(
      async () =>
        await authClient.passkey.addPasskey({
          authenticatorAttachment: "platform",
        }),
    );
    setIsAdding(false);
    if (result.error) {
      Alert.alert(
        "Couldn't Add Passkey",
        result.error.message ?? "Try again in a moment.",
      );
    }
  }

  return (
    <ActionRow
      disabled={isAdding}
      label="Add Passkey"
      onPress={() => void addPasskey()}
    />
  );
}

function SignOutRow() {
  const registerPushToken = useMutation(
    api.notifications.mutations.registerPushToken,
  );
  const unregisterPushToken = useMutation(
    api.notifications.mutations.unregisterPushToken,
  );

  async function signOut() {
    try {
      await unregisterCurrentPushToken(unregisterPushToken);
    } catch {
      Alert.alert(
        "Couldn't Sign Out",
        "Notifications are still on. Try again.",
      );
      return;
    }
    const result = await authClient.signOut();
    if (result.error) {
      await registerForNewMailNotifications(registerPushToken).catch(
        () => undefined,
      );
      Alert.alert("Couldn't Sign Out", result.error.message ?? "Try again.");
    }
  }

  function confirm() {
    Alert.alert("Sign Out of Rodge Mail?", undefined, [
      { style: "cancel", text: "Cancel" },
      { onPress: () => void signOut(), style: "destructive", text: "Sign Out" },
    ]);
  }

  return <ActionRow destructive label="Sign Out" onPress={confirm} />;
}

function SeedMailRow() {
  const seedDemoMail = useMutation(api.devSeed.seedDemoMail);
  const [isSeeding, setIsSeeding] = useState(false);

  async function seed() {
    setIsSeeding(true);
    try {
      await seedDemoMail({});
    } catch {
      Alert.alert("Couldn't Load Sample Mail");
    }
    setIsSeeding(false);
  }

  return (
    <ActionRow
      disabled={isSeeding}
      icon="tray.and.arrow.down"
      label="Load Sample Mailbox"
      onPress={() => void seed()}
    />
  );
}

function NotificationPreviewRow() {
  const threadId = useMailStore((store) => store.threads.at(0)?.id);

  function preview() {
    if (!threadId) return;
    scheduleLocalNotificationPreview(threadId, threadId).catch(() =>
      Alert.alert("Couldn't Post a Notification"),
    );
  }

  return (
    <ActionRow
      disabled={!threadId}
      icon="bell.badge"
      label="Preview Notification"
      onPress={preview}
    />
  );
}
