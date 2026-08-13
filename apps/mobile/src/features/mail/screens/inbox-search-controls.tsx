import { Stack, useFocusEffect } from "expo-router";

import type { MobileMailbox } from "../store";
import {
  blurNativeSearch,
  focusNativeSearch,
  nativeSearchBarRef,
} from "../native-search-controller";
import { getMailboxSearchPlaceholder } from "./mailbox-controls";

export function InboxSearchControls({
  mailbox,
  onChange,
  onSearchClose,
  searchMode,
}: {
  mailbox: MobileMailbox;
  onChange: (value: string) => void;
  onSearchClose: () => void;
  searchMode: boolean;
}) {
  if (!searchMode) return <Stack.Screen options={{ headerShown: false }} />;
  return (
    <FocusedSearchBar
      placeholder={getMailboxSearchPlaceholder(mailbox) ?? "Search mail"}
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
  useFocusEffect(() => {
    const frame = requestAnimationFrame(focusNativeSearch);
    return () => {
      cancelAnimationFrame(frame);
      blurNativeSearch();
    };
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerLargeTitle: false,
          headerTransparent: true,
          title: "",
        }}
      />
      <Stack.SearchBar
        hideNavigationBar
        hideWhenScrolling={false}
        obscureBackground={false}
        onCancelButtonPress={() => {
          onSearchChange("");
          onSearchClose();
        }}
        onChangeText={(event) => onSearchChange(event.nativeEvent.text)}
        placeholder={placeholder}
        placement="automatic"
        ref={nativeSearchBarRef}
      />
    </>
  );
}
