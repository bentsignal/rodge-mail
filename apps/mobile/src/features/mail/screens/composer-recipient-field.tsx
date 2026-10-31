import { useRef, useState } from "react";
import { Pressable, Text, TextInput } from "react-native";

import { useColor } from "~/hooks/use-color";
import { ComposerRow } from "./composer-field";
import {
  getRecipientToken,
  joinRecipientTokens,
  splitRecipientTokens,
  takeRecipientTokens,
} from "./composer-presentation";

/**
 * Recipients as compact tokens followed by the text being typed, like Mail.
 * Backspace on an empty field selects the last token, and again removes it.
 */
export function ComposerRecipientField({
  autoFocus = false,
  defaultValue,
  error,
  label,
  onChange,
}: {
  autoFocus?: boolean;
  defaultValue: string;
  error?: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const pending = useRef("");
  const [tokens, setTokens] = useState(() => splitRecipientTokens(defaultValue));
  const [selectedIndex, setSelectedIndex] = useState<number>();
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");

  function commit(nextTokens: string[], nextPending: string) {
    setTokens(nextTokens);
    setSelectedIndex(undefined);
    pending.current = nextPending;
    onChange(joinRecipientTokens(nextTokens, nextPending));
  }

  function handleChangeText(text: string) {
    const taken = takeRecipientTokens(text);
    if (taken.tokens.length === 0) {
      setSelectedIndex(undefined);
      pending.current = text;
      onChange(joinRecipientTokens(tokens, text));
      return;
    }
    inputRef.current?.clear();
    commit([...tokens, ...taken.tokens], taken.pending);
  }

  function commitPending() {
    const text = pending.current.trim();
    if (!text) return;
    inputRef.current?.clear();
    commit([...tokens, ...splitRecipientTokens(text)], "");
  }

  function handleBackspace() {
    if (pending.current.length > 0 || tokens.length === 0) return;
    if (selectedIndex === undefined) {
      setSelectedIndex(tokens.length - 1);
      return;
    }
    commit(
      tokens.filter((_, index) => index !== selectedIndex),
      pending.current,
    );
  }

  return (
    <ComposerRow error={error} label={`${label}:`}>
      {tokens.map((token, index) => (
        <RecipientToken
          key={`${token}:${index}`}
          selected={index === selectedIndex}
          token={token}
          onPress={() => {
            setSelectedIndex(index === selectedIndex ? undefined : index);
            inputRef.current?.focus();
          }}
        />
      ))}
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        autoFocus={autoFocus}
        className="text-foreground min-h-8 min-w-24 flex-1 text-base"
        keyboardType="email-address"
        placeholderTextColor={mutedForeground}
        returnKeyType="next"
        selectionColor={primary}
        style={{ color: foreground, paddingVertical: 4 }}
        submitBehavior="submit"
        testID={`composer-${label.toLocaleLowerCase()}-field`}
        textContentType="emailAddress"
        onBlur={commitPending}
        onChangeText={handleChangeText}
        onKeyPress={(event) => {
          if (event.nativeEvent.key === "Backspace") handleBackspace();
        }}
        onSubmitEditing={commitPending}
      />
    </ComposerRow>
  );
}

function RecipientToken({
  onPress,
  selected,
  token,
}: {
  onPress: () => void;
  selected: boolean;
  token: string;
}) {
  const { label, valid } = getRecipientToken(token);
  return (
    <Pressable
      accessibilityLabel={valid ? label : `${label}, invalid address`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={
        selected
          ? "bg-primary rounded-md px-1.5 py-0.5"
          : "bg-muted rounded-md px-1.5 py-0.5"
      }
      hitSlop={4}
      onPress={onPress}
    >
      <Text
        className={
          selected
            ? "text-primary-foreground text-base"
            : valid
              ? "text-foreground text-base"
              : "text-destructive text-base"
        }
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
