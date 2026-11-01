import { useState } from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { FieldGroup, Picker, Row, Spacer, Text } from "@expo/ui";
import { frame } from "@expo/ui/swift-ui/modifiers";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { MobileThemeMode } from "~/features/theme/mobile-theme";
import { useMailStore } from "~/features/mail/store";
import { scheduleLocalNotificationPreview } from "~/features/notifications/mobile-notifications";
import {
  setMobileThemeMode,
  useMobileAppearance,
} from "~/features/theme/mobile-theme";
import { NativeHost } from "./native-host";
import {
  AddPasskeyRow,
  OwnerRow,
  PasskeyItem,
  SignOutRow,
  usePasskeyGroups,
} from "./rodge-account-rows";
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
  const passkeys = usePasskeyGroups();
  function passkeyItems(group: keyof typeof passkeys.groups) {
    return passkeys.groups[group].map((row) => (
      <PasskeyItem key={row.passkey.id} onRemove={passkeys.remove} row={row} />
    ));
  }
  // Sections stay direct children of FieldGroup: Android wraps a section
  // returned from a component in a second card.
  const developerSection = __DEV__ ? (
    <FieldGroup.Section title="Developer">
      <SeedMailRow />
      <NotificationPreviewRow />
    </FieldGroup.Section>
  ) : null;
  const websitePasskeySection =
    passkeys.groups.website.length > 0 ? (
      <FieldGroup.Section title="Website Passkeys">
        {passkeyItems("website")}
      </FieldGroup.Section>
    ) : null;
  const otherPasskeySection =
    passkeys.groups.unknown.length > 0 ? (
      <FieldGroup.Section title="Other Passkeys">
        {passkeyItems("unknown")}
      </FieldGroup.Section>
    ) : null;

  return (
    <NativeHost style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section title="Mail Accounts">
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
        <FieldGroup.Section title="Rodge Mail Account">
          <OwnerRow />
        </FieldGroup.Section>
        <FieldGroup.Section title="iPhone App Passkeys">
          {passkeyItems("app")}
          <AddPasskeyRow />
        </FieldGroup.Section>
        {websitePasskeySection}
        {otherPasskeySection}
        <FieldGroup.Section>
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
