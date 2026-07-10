import { useState } from "react";
import { Image, ScrollView, Switch, Text, View } from "react-native";

import { DEMO_MAIL_ACCOUNTS } from "@rodge-mail/features/mail";

import roundedIcon from "../../../../assets/rounded-icon.png";

export function MailSettingsScreen() {
  const [focusedInboxEnabled, setFocusedInboxEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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
        {DEMO_MAIL_ACCOUNTS.map((account) => (
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
      <View className="px-2">
        <Text className="text-muted-foreground text-center text-xs leading-5">
          Demo mailbox · Provider connections and passkey sign-in are next.
        </Text>
      </View>
    </ScrollView>
  );
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
