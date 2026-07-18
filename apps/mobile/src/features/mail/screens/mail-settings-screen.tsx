import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { Bell, Fingerprint, LogOut } from "lucide-react-native";

import { api } from "@rodge-mail/convex/api";

import { useColor } from "~/hooks/use-color";
import roundedIcon from "../../../../assets/rounded-icon.png";
import { authClient } from "../../auth/client";
import { retryTransientPasskeyAssociation } from "../../auth/native-passkey-operation";
import {
  registerForNewMailNotifications,
  scheduleLocalNotificationPreview,
  unregisterCurrentPushToken,
} from "../../notifications/mobile-notifications";
import { NotificationPreferences } from "../../notifications/notification-preferences";
import { MobileAppearanceSettings } from "../../theme/mobile-appearance-settings";
import { useMailStore } from "../store";
import { AccountConnections } from "./account-connections";
import { AccountLabelSettings } from "./account-label-settings";
import { SettingsSection } from "./settings-section";
import { TemporaryIos27SearchSetting } from "./temporary-ios27-search-setting";

export function MailSettingsScreen() {
  const accounts = useMailStore((store) => store.accounts);
  return (
    <ScrollView
      className="bg-background"
      contentContainerClassName="gap-6 px-4 pb-20"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="items-center gap-2 pt-3">
        <Image
          accessibilityLabel="Rodge Mail"
          source={roundedIcon}
          className="border-brass/50 size-20 rounded-[22px] border"
        />
        <Text className="text-foreground text-xl font-bold">Rodge Mail</Text>
      </View>
      <SettingsSection title="Appearance">
        <MobileAppearanceSettings />
      </SettingsSection>
      <IosCompatibilitySettings />
      <SettingsSection title="Mail accounts">
        <AccountLabelSettings accounts={accounts} />
      </SettingsSection>
      <SettingsSection title="Add account">
        <AccountConnections />
      </SettingsSection>
      <SettingsSection title="Notifications">
        <NotificationPreferences />
      </SettingsSection>
      <SettingsSection title="Account">
        <SignOutButton />
        <AddPasskeyButton />
      </SettingsSection>
      <DevelopmentTools />
    </ScrollView>
  );
}

function IosCompatibilitySettings() {
  if (Platform.OS !== "ios") return null;
  return (
    <SettingsSection title="Compatibility">
      <TemporaryIos27SearchSetting />
    </SettingsSection>
  );
}

function DevelopmentTools() {
  const seedDemoMail = useMutation(api.devSeed.seedDemoMail);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>();

  if (!__DEV__) return null;

  async function seed() {
    setIsLoading(true);
    setMessage(undefined);
    try {
      const result = await seedDemoMail({});
      setMessage(`${result.totalMessages} sample messages are ready.`);
    } catch {
      setMessage("Could not load the sample mailbox.");
    }
    setIsLoading(false);
  }

  return (
    <SettingsSection title="Development">
      <View className="border-border border-b">
        <Pressable
          accessibilityRole="button"
          className="flex-row items-center gap-3 px-4 py-4 disabled:opacity-50"
          disabled={isLoading}
          onPress={() => void seed()}
        >
          <DevelopmentIcon isLoading={isLoading} />
          <View className="flex-1 gap-0.5">
            <Text className="text-foreground font-semibold">
              Load sample mailbox
            </Text>
            <Text className="text-muted-foreground text-sm">
              Seed idempotent Convex fixtures for this mailbox.
            </Text>
          </View>
        </Pressable>
        <SecurityMessage message={message} />
      </View>
      <NotificationPreviewButton />
    </SettingsSection>
  );
}

function DevelopmentIcon({ isLoading }: { isLoading: boolean }) {
  const primary = useColor("primary");
  if (isLoading) return <ActivityIndicator color={primary} />;
  return <Text className="text-primary font-mono text-xs font-bold">DEV</Text>;
}

function NotificationPreviewButton() {
  const threadId = useMailStore((store) => store.threads.at(0)?.id);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>();

  async function preview() {
    if (!threadId) {
      setMessage("Load mail before previewing a notification.");
      return;
    }
    setIsLoading(true);
    setMessage(undefined);
    try {
      await scheduleLocalNotificationPreview(threadId, threadId);
      setMessage("Notification posted. Tap it to open this thread.");
    } catch {
      setMessage("Could not post notification preview.");
    }
    setIsLoading(false);
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-3 px-4 py-4 disabled:opacity-50"
        disabled={isLoading}
        onPress={() => void preview()}
      >
        <NotificationPreviewIcon isLoading={isLoading} />
        <View className="flex-1 gap-0.5">
          <Text className="text-foreground font-semibold">
            Preview notification
          </Text>
          <Text className="text-muted-foreground text-sm">
            Post a local alert and test its thread link.
          </Text>
        </View>
      </Pressable>
      <SecurityMessage message={message} />
    </View>
  );
}

function NotificationPreviewIcon({ isLoading }: { isLoading: boolean }) {
  const primary = useColor("primary");
  if (isLoading) return <ActivityIndicator color={primary} />;
  return <Bell color={primary} size={20} />;
}

function AddPasskeyButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>();

  async function addPasskey() {
    setIsLoading(true);
    setMessage(undefined);
    const result = await retryTransientPasskeyAssociation(
      async () =>
        await authClient.passkey.addPasskey({
          authenticatorAttachment: "platform",
        }),
    );
    setIsLoading(false);
    if (result.error) {
      setMessage(result.error.message ?? "Could not add this passkey.");
      return;
    }
    setMessage("Passkey added to Rodge Mail.");
  }

  return (
    <View className="border-border border-t">
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-3 px-4 py-4 disabled:opacity-50"
        disabled={isLoading}
        onPress={() => void addPasskey()}
      >
        <AddPasskeyIcon isLoading={isLoading} />
        <View className="flex-1 gap-0.5">
          <Text className="text-foreground font-semibold">
            Add another passkey
          </Text>
          <Text className="text-muted-foreground text-sm">
            For another device or password manager.
          </Text>
        </View>
      </Pressable>
      <SecurityMessage message={message} />
    </View>
  );
}

function AddPasskeyIcon({ isLoading }: { isLoading: boolean }) {
  const primary = useColor("primary");
  if (isLoading) return <ActivityIndicator color={primary} />;
  return <Fingerprint color={primary} size={20} />;
}

function SecurityMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <Text className="text-muted-foreground px-4 pb-3 text-xs">{message}</Text>
  );
}

function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>();
  const registerPushToken = useMutation(
    api.notifications.mutations.registerPushToken,
  );
  const unregisterPushToken = useMutation(
    api.notifications.mutations.unregisterPushToken,
  );

  async function signOut() {
    setIsLoading(true);
    setMessage(undefined);
    try {
      await unregisterCurrentPushToken(unregisterPushToken);
    } catch {
      setMessage("Could not disable notifications. Try signing out again.");
      setIsLoading(false);
      return;
    }
    const result = await authClient.signOut();
    if (result.error) {
      await registerForNewMailNotifications(registerPushToken).catch(
        () => undefined,
      );
      setMessage(result.error.message ?? "Could not sign out. Try again.");
      setIsLoading(false);
    }
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-3 px-4 py-4 disabled:opacity-50"
        disabled={isLoading}
        onPress={() => void signOut()}
      >
        <SignOutIcon isLoading={isLoading} />
        <View className="flex-1 gap-0.5">
          <Text className="text-foreground font-semibold">Sign out</Text>
          <Text className="text-muted-foreground text-sm">
            Remove this device&apos;s Rodge Mail session.
          </Text>
        </View>
      </Pressable>
      <SecurityMessage message={message} />
    </View>
  );
}

function SignOutIcon({ isLoading }: { isLoading: boolean }) {
  const stamp = useColor("stamp");
  if (isLoading) return <ActivityIndicator color={stamp} />;
  return <LogOut color={stamp} size={20} />;
}
