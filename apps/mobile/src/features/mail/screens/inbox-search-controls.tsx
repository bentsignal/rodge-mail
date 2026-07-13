import { Stack } from "expo-router";

import { useColor } from "~/hooks/use-color";
import { nativeSearchBarRef } from "../native-search-controller";

export function InboxSearchControls({
  mailbox,
  onChange,
  onSearchClose,
  searchMode,
}: {
  mailbox: "archive" | "inbox";
  onChange: (value: string) => void;
  onSearchClose: () => void;
  searchMode: boolean;
}) {
  if (!searchMode) return <Stack.Screen options={{ headerShown: false }} />;
  return (
    <FocusedSearchBar
      placeholder={mailbox === "archive" ? "Search archive" : "Search mail"}
      onSearchChange={onChange}
      onSearchClose={onSearchClose}
    />
  );
}

function FocusedSearchBar({
  placeholder,
  onSearchChange,
  onSearchClose,
}: {
  placeholder: string;
  onSearchChange: (value: string) => void;
  onSearchClose: () => void;
}) {
  const foreground = useColor("foreground");
  const paper = useColor("paper");
  const primary = useColor("primary");

  return (
    <Stack.Screen
      options={{
        headerSearchBarOptions: {
          barTintColor: paper,
          hideNavigationBar: true,
          hideWhenScrolling: false,
          onCancelButtonPress: () => {
            onSearchChange("");
            onSearchClose();
          },
          onChangeText: (event) => onSearchChange(event.nativeEvent.text),
          placeholder,
          placement: "automatic",
          ref: nativeSearchBarRef,
          textColor: foreground,
          tintColor: primary,
        },
        headerShown: false,
      }}
    />
  );
}
