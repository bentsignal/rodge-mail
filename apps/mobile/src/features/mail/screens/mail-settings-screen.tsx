import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { Fingerprint, LogOut } from "lucide-react-native";

import { api } from "@rodge-mail/convex/api";

import roundedIcon from "../../../../assets/rounded-icon.png";
import { authClient } from "../../auth/client";
import { useMailStore } from "../store";

export function MailSettingsScreen() {
  const [focusedInboxEnabled, setFocusedInboxEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
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
        <Text className="text-muted-foreground text-sm">
          Your mail, without the noise.
        </Text>
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
              {account.provider}
            </Text>
          </View>
        ))}
      </SettingsSection>
      <SettingsSection title="Inbox">
        <SettingsToggle
          label="Focused Inbox"
          description="Prioritize people, deliveries, deadlines, and account alerts."
          value={focusedInboxEnabled}
          onChange={setFocusedInboxEnabled}
        />
        <SettingsToggle
          label="Notifications"
          description="Notify only for unread Focused mail."
          value={notificationsEnabled}
          onChange={setNotificationsEnabled}
        />
      </SettingsSection>
      <SettingsSection title="Security">
        <AddPasskeyButton />
        <SignOutButton />
      </SettingsSection>
      <DevelopmentTools />
      <View className="px-2">
        <Text className="text-muted-foreground text-center text-xs leading-5">
          Passkey protected · Provider connections are in progress.
        </Text>
      </View>
    </ScrollView>
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
            Seed idempotent Convex fixtures for this owner.
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
      name: "Mobile passkey",
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
            Save another credential to this device.
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

  async function signOut() {
    setIsLoading(true);
    const result = await authClient.signOut();
    if (result.error) {
      setIsLoading(false);
    }
  }

  return (
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

function SettingsToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
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
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}
