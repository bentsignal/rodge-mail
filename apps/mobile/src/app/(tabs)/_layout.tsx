import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useColor } from "~/hooks/use-color";

export default function TabLayout() {
  const backgroundColor = useColor("background");
  const primary = useColor("primary");

  return (
    <NativeTabs
      backgroundColor={backgroundColor}
      minimizeBehavior="onScrollDown"
      tintColor={primary}
    >
      <NativeTabs.Trigger name="(inbox)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "tray", selected: "tray.fill" }}
          md="inbox"
        />
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(new)">
        <NativeTabs.Trigger.Icon sf="square.and.pencil" md="edit" />
        <NativeTabs.Trigger.Label>New</NativeTabs.Trigger.Label>
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
