import { useState } from "react";
import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { FieldGroup, Text, TextInput } from "@expo/ui";
import { useAction } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { OAuthMailProvider } from "~/features/mail/screens/provider-connection";
import {
  getMobileProviderReturnPath,
  getProviderConnectionMessage,
  getProviderConnectionResult,
  MOBILE_PROVIDER_REDIRECT_URL,
} from "~/features/mail/screens/provider-connection";
import { useColor } from "~/hooks/use-color";
import { NativeHost } from "./native-host";
import { ActionRow } from "./settings-rows";

type Provider = OAuthMailProvider | "icloud";

export function AddAccountScreen() {
  const connectICloud = useAction(api.providers.icloud.actions.connect);
  const [connecting, setConnecting] = useState<Provider>();
  const connectOAuth = useOAuthConnection(setConnecting);
  const [showICloud, setShowICloud] = useState(false);
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const muted = useColor("muted-foreground");

  // The server has to check the password with iCloud before it's added.
  async function submitICloud() {
    setConnecting("icloud");
    try {
      await connectICloud({ address, password });
      setPassword("");
      setShowICloud(false);
      Alert.alert("iCloud Connected", "The first sync is running.");
    } catch (error) {
      Alert.alert("Couldn't Connect", getErrorMessage(error));
    }
    setConnecting(undefined);
  }

  const canSubmit = address.trim().length > 0 && password.trim().length > 0;
  // A direct child of FieldGroup: Android wraps a section returned from a
  // component in a second card.
  const icloudSection = showICloud ? (
    <FieldGroup.Section title="iCloud Mail">
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholderTextColor={muted}
        placeholder="you@icloud.com"
        onChangeText={setAddress}
      />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={muted}
        placeholder="App-specific password"
        secureTextEntry
        onChangeText={setPassword}
      />
      <ActionRow
        disabled={!canSubmit || connecting !== undefined}
        label="Connect"
        onPress={() => void submitICloud()}
      />
      <FieldGroup.SectionFooter>
        <Text>
          Create an app-specific password at account.apple.com. Never use your
          Apple Account password.
        </Text>
      </FieldGroup.SectionFooter>
    </FieldGroup.Section>
  ) : null;

  return (
    <NativeHost style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section>
          <ActionRow
            disabled={connecting !== undefined}
            icon="envelope"
            label="Gmail"
            onPress={() => void connectOAuth("gmail")}
          />
          <ActionRow
            disabled={connecting !== undefined}
            icon="briefcase"
            label="Microsoft 365"
            onPress={() => void connectOAuth("microsoft")}
          />
          <ActionRow
            disabled={connecting !== undefined}
            icon="icloud"
            label="iCloud Mail"
            onPress={() => setShowICloud((current) => !current)}
          />
        </FieldGroup.Section>
        {icloudSection}
      </FieldGroup>
    </NativeHost>
  );
}

function useOAuthConnection(
  setConnecting: (provider: Provider | undefined) => void,
) {
  const connectGmail = useAction(api.accounts.actions.connectGmail);
  const connectMicrosoft = useAction(api.accounts.actions.connectMicrosoft);

  // Provider sign-in happens in the system browser; only it can answer.
  return async function connectOAuth(provider: OAuthMailProvider) {
    setConnecting(provider);
    try {
      const start = provider === "gmail" ? connectGmail : connectMicrosoft;
      const authorization = await start({
        returnPath: getMobileProviderReturnPath(provider),
      });
      const session = await WebBrowser.openAuthSessionAsync(
        authorization.authorizationUrl,
        MOBILE_PROVIDER_REDIRECT_URL,
      );
      const result = getProviderConnectionResult(
        provider,
        session.type === "success" ? session.url : undefined,
      );
      const message = getProviderConnectionMessage(provider, result);
      if (message) Alert.alert(message);
    } catch (error) {
      Alert.alert("Couldn't Connect", getErrorMessage(error));
    }
    setConnecting(undefined);
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Try again in a moment.";
}
