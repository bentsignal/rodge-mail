import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useAction } from "convex/react";
import {
  BriefcaseBusiness,
  ChevronRight,
  Cloud,
  Mail,
} from "lucide-react-native";

import { api } from "@rodge-mail/convex/api";

import type { OAuthMailProvider } from "./provider-connection";
import { useColor } from "~/hooks/use-color";
import {
  getMobileProviderReturnPath,
  getProviderConnectionMessage,
  getProviderConnectionResult,
  MOBILE_PROVIDER_REDIRECT_URL,
} from "./provider-connection";

export function AccountConnections() {
  const connectGmail = useAction(api.accounts.actions.connectGmail);
  const connectMicrosoft = useAction(api.accounts.actions.connectMicrosoft);
  const connectICloud = useAction(api.providers.icloud.actions.connect);
  const [connectingProvider, setConnectingProvider] = useState<
    OAuthMailProvider | "icloud"
  >();
  const [showICloudForm, setShowICloudForm] = useState(false);
  const [icloudAddress, setICloudAddress] = useState("");
  const [icloudPassword, setICloudPassword] = useState("");
  const [message, setMessage] = useState<string>();

  async function connectOAuth(provider: OAuthMailProvider) {
    setConnectingProvider(provider);
    setMessage(undefined);
    try {
      const startAuthorization =
        provider === "gmail" ? connectGmail : connectMicrosoft;
      const authorization = await startAuthorization({
        returnPath: getMobileProviderReturnPath(provider),
      });
      const authSession = await WebBrowser.openAuthSessionAsync(
        authorization.authorizationUrl,
        MOBILE_PROVIDER_REDIRECT_URL,
      );
      const result = getProviderConnectionResult(
        provider,
        authSession.type === "success" ? authSession.url : undefined,
      );
      setMessage(getProviderConnectionMessage(provider, result));
    } catch (error) {
      setMessage(getConnectionError(error));
    }
    setConnectingProvider(undefined);
  }

  async function submitICloud() {
    setConnectingProvider("icloud");
    setMessage(undefined);
    try {
      await connectICloud({
        address: icloudAddress,
        password: icloudPassword,
      });
      setICloudPassword("");
      setShowICloudForm(false);
      setMessage("iCloud connected. Initial sync is running.");
    } catch (error) {
      setMessage(getConnectionError(error));
    }
    setConnectingProvider(undefined);
  }

  return (
    <View>
      <ProviderButton
        icon={Mail}
        isLoading={connectingProvider === "gmail"}
        label="Gmail"
        detail="Google and Google Workspace"
        onPress={() => void connectOAuth("gmail")}
      />
      <ProviderButton
        icon={BriefcaseBusiness}
        isLoading={connectingProvider === "microsoft"}
        label="Microsoft 365"
        detail="Outlook and Microsoft 365"
        onPress={() => void connectOAuth("microsoft")}
      />
      <ProviderButton
        icon={Cloud}
        isLoading={connectingProvider === "icloud"}
        label="iCloud Mail"
        detail="Use an Apple app-specific password"
        onPress={() => setShowICloudForm((current) => !current)}
      />
      <ICloudFormVisibility
        address={icloudAddress}
        isLoading={connectingProvider === "icloud"}
        isVisible={showICloudForm}
        password={icloudPassword}
        onAddressChange={setICloudAddress}
        onPasswordChange={setICloudPassword}
        onSubmit={() => void submitICloud()}
      />
      <ConnectionMessage message={message} />
    </View>
  );
}

function ProviderButton({
  detail,
  icon: Icon,
  isLoading,
  label,
  onPress,
}: {
  detail: string;
  icon: typeof Mail;
  isLoading: boolean;
  label: string;
  onPress: () => void;
}) {
  const primary = useColor("primary");
  const mutedForeground = useColor("muted-foreground");
  return (
    <Pressable
      accessibilityLabel={`Connect ${label}`}
      accessibilityRole="button"
      className="border-well-border min-h-16 flex-row items-center gap-3 border-b px-4 py-3 disabled:opacity-50"
      disabled={isLoading}
      onPress={onPress}
    >
      <View className="bg-paper-deep border-paper-border size-10 items-center justify-center rounded-lg border">
        <Icon color={primary} size={19} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-foreground font-semibold">{label}</Text>
        <Text className="text-muted-foreground text-sm" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <ProviderButtonAccessory
        isLoading={isLoading}
        mutedForeground={mutedForeground}
        primary={primary}
      />
    </Pressable>
  );
}

function ProviderButtonAccessory({
  isLoading,
  mutedForeground,
  primary,
}: {
  isLoading: boolean;
  mutedForeground: string;
  primary: string;
}) {
  if (isLoading) return <ActivityIndicator color={primary} />;
  return <ChevronRight color={mutedForeground} size={18} />;
}

function ICloudFormVisibility({
  isVisible,
  ...props
}: React.ComponentProps<typeof ICloudForm> & { isVisible: boolean }) {
  if (!isVisible) return null;
  return <ICloudForm {...props} />;
}

function ICloudForm({
  address,
  isLoading,
  onAddressChange,
  onPasswordChange,
  onSubmit,
  password,
}: {
  address: string;
  isLoading: boolean;
  onAddressChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  password: string;
}) {
  const mutedForeground = useColor("muted-foreground");
  const canSubmit = address.trim().length > 0 && password.trim().length > 0;
  return (
    <View className="bg-paper-deep border-well-border gap-3 border-b px-4 py-4">
      <TextInput
        accessibilityLabel="iCloud Mail address"
        autoCapitalize="none"
        autoComplete="email"
        className="bg-paper border-paper-border text-foreground min-h-12 rounded-lg border px-3.5"
        keyboardType="email-address"
        onChangeText={onAddressChange}
        placeholder="you@icloud.com"
        placeholderTextColor={mutedForeground}
        defaultValue={address}
      />
      <TextInput
        accessibilityLabel="iCloud app-specific password"
        autoCapitalize="none"
        autoComplete="off"
        className="bg-paper border-paper-border text-foreground min-h-12 rounded-lg border px-3.5"
        onChangeText={onPasswordChange}
        placeholder="xxxx-xxxx-xxxx-xxxx"
        placeholderTextColor={mutedForeground}
        secureTextEntry
        defaultValue={password}
      />
      <Text className="text-muted-foreground text-xs leading-4">
        Create this password at account.apple.com. Never enter your primary
        Apple Account password.
      </Text>
      <Pressable
        accessibilityRole="button"
        className="bg-primary min-h-11 items-center justify-center rounded-lg px-4 disabled:opacity-40"
        disabled={!canSubmit || isLoading}
        onPress={onSubmit}
      >
        <ICloudSubmitContent isLoading={isLoading} />
      </Pressable>
    </View>
  );
}

function ICloudSubmitContent({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <ActivityIndicator color="white" />;
  return (
    <Text className="text-primary-foreground font-semibold">
      Connect iCloud Mail
    </Text>
  );
}

function ConnectionMessage({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <Text className="text-muted-foreground px-4 py-3 text-xs">{message}</Text>
  );
}

function getConnectionError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not connect this mail account. Try again.";
}
