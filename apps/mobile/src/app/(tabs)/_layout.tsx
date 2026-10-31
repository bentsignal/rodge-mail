import { NativeTabs } from "expo-router/unstable-native-tabs";

import {
  blurNativeSearch,
  focusNativeSearch,
} from "~/features/mail/native-search-controller";
import { useMailStore } from "~/features/mail/store";
import { useColor } from "~/hooks/use-color";

export default function TabLayout() {
  const backgroundColor = useColor("background");
  const primary = useColor("primary");
  const selectionMode = useMailStore((store) => store.selectionMode);

  return (
    <NativeTabs
      backgroundColor={backgroundColor}
      hidden={selectionMode}
      minimizeBehavior="onScrollDown"
      tintColor={primary}
    >
      <NativeTabs.Trigger name="(inbox)" contentStyle={{ backgroundColor }}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md="home"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(new)" contentStyle={{ backgroundColor }}>
        <NativeTabs.Trigger.Icon sf="square.and.pencil" md="edit" />
        <NativeTabs.Trigger.Label>New</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)" contentStyle={{ backgroundColor }}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="(search)"
        contentStyle={{ backgroundColor }}
        listeners={{
          blur: blurNativeSearch,
          focus: focusNativeSearch,
        }}
        role="search"
      >
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
