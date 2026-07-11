import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { Fingerprint, LogOut } from "lucide-react-native";

import { api } from "@rodge-mail/convex/api";

import roundedIcon from "../../../../assets/rounded-icon.png";
import { authClient } from "../../auth/client";
import {
  registerForNewMailNotifications,
  unregisterCurrentPushToken,
} from "../../notifications/mobile-notifications";
import { NotificationPreferences } from "../../notifications/notification-preferences";
import { useMailStore } from "../store";

export function MailSettingsScreen() {
  const accounts = useMailStore((store) => store.accounts);

  return (
    <ScrollView
      className="bg-background"
      contentContainerClassName="gap-6 px-4 pb-16"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="items-center gap-2 pt-3">
        <Image
          accessibilityLabel="Rodge Mail"
          source={roundedIcon}
          className="size-20 rounded-[22px]"
        />
        <Text className="text-foreground text-xl font-bold">Rodge Mail</Text>
      </View>
      <SettingsSection title="Mail accounts">
        {accounts.map((account) => (
          <View
            key={account.id}
            className="border-border flex-row items-center gap-3 border-b px-4 py-3 last:border-b-0"
          >
            <View
              className="size-10 items-center justify-center rounded-full"
              style={{ backgroundColor: account.accent }}
            >
              <Text className="font-bold text-white">{account.initials}</Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-foreground font-semibold">
                {account.label}
              </Text>
              <Text className="text-muted-foreground text-sm" numberOfLines={1}>
                {account.address}
              </Text>
            </View>
            <Text className="text-muted-foreground text-xs capitalize">
              {getAccountStatusLabel(account.status, account.provider)}
            </Text>
          </View>
        ))}
      </SettingsSection>
      <SettingsSection title="Notifications">
        <NotificationPreferences />
      </SettingsSection>
      <SettingsSection title="Security">
        <AddPasskeyButton />
        <SignOutButton />
      </SettingsSection>
      <DevelopmentTools />
    </ScrollView>
  );
}

function getAccountStatusLabel(
  status:
    | "connected"
    | "disconnected"
    | "error"
    | "reauthorization_required"
    | "syncing",
  provider: "gmail" | "icloud" | "microsoft",
) {
  if (status === "syncing") return "Syncing";
  if (status === "error") return "Sync error";
  if (status === "reauthorization_required") return "Reconnect";
  if (status === "disconnected") return "Offline";
  return provider;
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
          <SecurityMessage message={message} />
        </View>
      </Pressable>
    </SettingsSection>
  );
}

function DevelopmentIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <ActivityIndicator color="#d77a55" />;
  return <Text className="text-primary font-mono text-xs font-bold">DEV</Text>;
}

function AddPasskeyButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>();

  async function addPasskey() {
    setIsLoading(true);
    setMessage(undefined);
    const result = await authClient.passkey.addPasskey({
      authenticatorAttachment: "platform",
    });
    setIsLoading(false);
    if (result.error) {
      setMessage(result.error.message ?? "Could not add this passkey.");
      return;
    }
    setMessage("Passkey added to Rodge Mail.");
  }

  return (
    <View className="border-border border-b">
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-3 px-4 py-4 disabled:opacity-50"
        disabled={isLoading}
        onPress={() => void addPasskey()}
      >
        <AddPasskeyIcon isLoading={isLoading} />
        <View className="flex-1 gap-0.5">
          <Text className="text-foreground font-semibold">Add a passkey</Text>
          <Text className="text-muted-foreground text-sm">
            Save another passkey for your account.
          </Text>
        </View>
      </Pressable>
      <SecurityMessage message={message} />
    </View>
  );
}

function AddPasskeyIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <ActivityIndicator color="#d77a55" />;
  return <Fingerprint color="#d77a55" size={20} />;
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
  if (isLoading) return <ActivityIndicator color="#d77a55" />;
  return <LogOut color="#d77a55" size={20} />;
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-muted-foreground px-2 text-xs font-semibold tracking-wider uppercase">
        {title}
      </Text>
      <View className="bg-muted/60 border-border overflow-hidden rounded-2xl border">
        {children}
      </View>
    </View>
  );
}
