import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useColor } from "~/hooks/use-color";

export default function TabLayout() {
  const primary = useColor("primary");

  return (
    <NativeTabs tintColor={primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(inbox)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "tray", selected: "tray.fill" }}
          md="inbox"
        />
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(search)" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
