import type { ComponentProps } from "react";
import { Platform } from "react-native";
import { Icon, ListItem, Row, Spacer, Text } from "@expo/ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { useColor } from "~/hooks/use-color";

export type SFSymbol = Extract<ComponentProps<typeof Icon>["name"], string>;

const fillRow = Platform.OS === "ios" ? [frame({ maxWidth: Infinity })] : [];

function RowIcon({ name }: { name: SFSymbol | undefined }) {
  const foreground = useColor("foreground");
  if (Platform.OS !== "ios" || name === undefined) return null;
  return <Icon color={foreground} name={name} size={20} />;
}

function Chevron() {
  const muted = useColor("muted-foreground");
  if (Platform.OS !== "ios") return null;
  return <Icon color={muted} name="chevron.right" size={13} />;
}

export function NavigationRow({
  icon,
  label,
  onPress,
  value,
}: {
  icon?: SFSymbol;
  label: string;
  onPress: () => void;
  value?: string;
}) {
  const muted = useColor("muted-foreground");
  const supporting =
    value === undefined ? undefined : (
      <Text numberOfLines={1} textStyle={{ color: muted, fontSize: 15 }}>
        {value}
      </Text>
    );
  return (
    <ListItem
      leading={icon ? <RowIcon name={icon} /> : undefined}
      supportingText={supporting}
      trailing={<Chevron />}
      onPress={onPress}
    >
      <Text>{label}</Text>
    </ListItem>
  );
}

export function ActionRow({
  destructive = false,
  disabled = false,
  icon,
  label,
  onPress,
}: {
  destructive?: boolean;
  disabled?: boolean;
  icon?: SFSymbol;
  label: string;
  onPress: () => void;
}) {
  const destructiveColor = useColor("destructive");
  const foreground = useColor("foreground");
  const muted = useColor("muted-foreground");
  const color = disabled ? muted : destructive ? destructiveColor : foreground;
  return (
    <ListItem
      leading={icon ? <RowIcon name={icon} /> : undefined}
      onPress={disabled ? undefined : onPress}
    >
      <Text textStyle={{ color }}>{label}</Text>
    </ListItem>
  );
}

export function ValueRow({ label, value }: { label: string; value: string }) {
  const muted = useColor("muted-foreground");
  return (
    <Row alignment="center" modifiers={fillRow}>
      <Text>{label}</Text>
      <Spacer />
      <Text numberOfLines={1} textStyle={{ color: muted }}>
        {value}
      </Text>
    </Row>
  );
}
