import { Host, Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

import type { InboxCategory } from "@rodge-mail/features/mail";

import type { CategoryControlProps } from "./category-control-types";

export function CategoryControl({ value, onChange }: CategoryControlProps) {
  return (
    <Host
      matchContents={{ vertical: true }}
      style={{ minHeight: 36, width: "100%" }}
    >
      <Picker<InboxCategory>
        selection={value}
        onSelectionChange={onChange}
        modifiers={[pickerStyle("segmented")]}
      >
        <Text modifiers={[tag("focused")]}>Focused</Text>
        <Text modifiers={[tag("other")]}>Other</Text>
      </Picker>
    </Host>
  );
}
