import type { SearchBarCommands } from "react-native-screens";
import { createRef } from "react";

export const nativeSearchBarRef = createRef<SearchBarCommands>();

export function focusNativeSearch() {
  nativeSearchBarRef.current?.focus();
}

export function blurNativeSearch() {
  nativeSearchBarRef.current?.blur();
}
