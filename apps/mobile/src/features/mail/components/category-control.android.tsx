import {
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from "@expo/ui/jetpack-compose";

import type { CategoryControlProps } from "./category-control-types";

export function CategoryControl({ value, onChange }: CategoryControlProps) {
  return (
    <Host
      matchContents={{ vertical: true }}
      style={{ minHeight: 44, width: "100%" }}
    >
      <SingleChoiceSegmentedButtonRow>
        <SegmentedButton
          selected={value === "focused"}
          onClick={() => onChange("focused")}
        >
          <SegmentedButton.Label>
            <Text>Focused</Text>
          </SegmentedButton.Label>
        </SegmentedButton>
        <SegmentedButton
          selected={value === "other"}
          onClick={() => onChange("other")}
        >
          <SegmentedButton.Label>
            <Text>Other</Text>
          </SegmentedButton.Label>
        </SegmentedButton>
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
