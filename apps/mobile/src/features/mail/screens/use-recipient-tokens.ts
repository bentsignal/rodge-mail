import type { TextInput } from "react-native";
import { useRef, useState } from "react";

import {
  addRecipientTokens,
  joinRecipientTokens,
  splitRecipientTokens,
  takeRecipientTokens,
} from "./composer-presentation";

/**
 * The token state behind a recipient field. The input stays uncontrolled:
 * committed text is cleared natively and kept here as tokens.
 */
export function useRecipientTokens(
  defaultValue: string,
  onChange: (value: string) => void,
) {
  const inputRef = useRef<TextInput>(null);
  const pending = useRef("");
  const changeCount = useRef(0);
  const [tokens, setTokens] = useState(() =>
    splitRecipientTokens(defaultValue),
  );
  const tokensRef = useRef(tokens);
  const [selectedIndex, setSelectedIndex] = useState<number>();

  function update(nextTokens: string[], nextPending: string) {
    tokensRef.current = nextTokens;
    pending.current = nextPending;
    setTokens(nextTokens);
    setSelectedIndex(undefined);
    onChange(joinRecipientTokens(nextTokens, nextPending));
  }

  // iOS ignores a clear inside the change event; the next frame sticks,
  // unless more typing arrived first.
  function clearInput() {
    const count = changeCount.current;
    requestAnimationFrame(() => {
      if (changeCount.current === count) inputRef.current?.clear();
    });
  }

  function handleChangeText(text: string) {
    changeCount.current += 1;
    const taken = takeRecipientTokens(text);
    if (taken.tokens.length === 0) {
      update(tokensRef.current, text);
      return;
    }
    update(addRecipientTokens(tokensRef.current, taken.tokens), "");
    clearInput();
  }

  function commitPending() {
    const added = splitRecipientTokens(pending.current);
    if (added.length === 0) return;
    update(addRecipientTokens(tokensRef.current, added), "");
    clearInput();
  }

  function handleBackspace() {
    const current = tokensRef.current;
    if (pending.current.length > 0 || current.length === 0) return;
    if (selectedIndex === undefined) {
      setSelectedIndex(current.length - 1);
      return;
    }
    update(
      current.filter((_, index) => index !== selectedIndex),
      pending.current,
    );
  }

  function toggleSelected(index: number) {
    setSelectedIndex((current) => (current === index ? undefined : index));
    inputRef.current?.focus();
  }

  return {
    commitPending,
    handleBackspace,
    handleChangeText,
    inputRef,
    selectedIndex,
    toggleSelected,
    tokens,
  };
}
