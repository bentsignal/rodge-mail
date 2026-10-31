import { useLocalSearchParams } from "expo-router";

import { AccountSettingsScreen } from "~/features/settings/account-settings-screen";

export default function AccountSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccountSettingsScreen accountId={id} />;
}
