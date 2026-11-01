import { useState } from "react";
import { Alert, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { Icon, ListItem, Text } from "@expo/ui";
import { useMutation } from "convex/react";

import type { PasskeyListItem } from "@rodge-mail/std/passkeys";
import { api } from "@rodge-mail/convex/api";
import {
  formatPasskeyAdded,
  getPasskeyLabel,
  useOptimisticPasskeys,
} from "@rodge-mail/std/passkeys";

import { authClient } from "~/features/auth/client";
import { retryTransientPasskeyAssociation } from "~/features/auth/native-passkey-operation";
import {
  registerForNewMailNotifications,
  unregisterCurrentPushToken,
} from "~/features/notifications/mobile-notifications";
import { useColor } from "~/hooks/use-color";
import { ActionRow } from "./settings-rows";

export function OwnerRow() {
  const session = authClient.useSession();
  const foreground = useColor("foreground");
  const muted = useColor("muted-foreground");
  const user = session.data?.user;
  if (!user) return null;

  const leading =
    Platform.OS === "ios" ? (
      <Icon color={foreground} name="person.crop.circle.fill" size={34} />
    ) : undefined;
  return (
    <ListItem
      leading={leading}
      supportingText={
        <Text numberOfLines={1} textStyle={{ color: muted, fontSize: 15 }}>
          {user.email}
        </Text>
      }
    >
      <Text textStyle={{ fontSize: 17, fontWeight: "600" }}>{user.name}</Text>
    </ListItem>
  );
}

export function PasskeyRows() {
  const query = authClient.useListPasskeys();
  useFocusEffect(() => {
    authClient.$store.notify("$listPasskeys");
  });
  const { canRemove, passkeys, remove } = useOptimisticPasskeys({
    deletePasskey: async (id) => await authClient.passkey.deletePasskey({ id }),
    onRemoveError: (message) => Alert.alert("Couldn't Remove Passkey", message),
    passkeys: query.data,
  });

  return (
    <>
      {passkeys.map((passkey) => (
        <PasskeyRow
          canRemove={canRemove}
          key={passkey.id}
          onRemove={() => void remove(passkey.id)}
          passkey={passkey}
        />
      ))}
    </>
  );
}

function PasskeyRow({
  canRemove,
  onRemove,
  passkey,
}: {
  canRemove: boolean;
  onRemove: () => void;
  passkey: PasskeyListItem;
}) {
  const destructive = useColor("destructive");
  const foreground = useColor("foreground");
  const muted = useColor("muted-foreground");
  const label = getPasskeyLabel(passkey);

  function confirm() {
    Alert.alert(
      "Remove Passkey?",
      `${label} won't sign you in to Rodge Mail anymore.`,
      [
        { style: "cancel", text: "Cancel" },
        { onPress: onRemove, style: "destructive", text: "Remove" },
      ],
    );
  }

  const leading =
    Platform.OS === "ios" ? (
      <Icon color={foreground} name="key" size={20} />
    ) : undefined;
  return (
    <ListItem
      leading={leading}
      supportingText={
        <Text numberOfLines={1} textStyle={{ color: muted, fontSize: 15 }}>
          {formatPasskeyAdded(passkey.createdAt)}
        </Text>
      }
      trailing={
        <Text textStyle={{ color: canRemove ? destructive : muted }}>
          Remove
        </Text>
      }
      onPress={canRemove ? confirm : undefined}
    >
      <Text>{label}</Text>
    </ListItem>
  );
}

export function AddPasskeyRow() {
  const [isAdding, setIsAdding] = useState(false);

  // The passkey sheet is the system's; nothing can show before it answers.
  async function addPasskey() {
    setIsAdding(true);
    const result = await retryTransientPasskeyAssociation(
      async () =>
        await authClient.passkey.addPasskey({
          authenticatorAttachment: "platform",
        }),
    );
    setIsAdding(false);
    if (result.error) {
      Alert.alert(
        "Couldn't Add Passkey",
        result.error.message ?? "Try again in a moment.",
      );
    }
  }

  return (
    <ActionRow
      disabled={isAdding}
      icon="plus.circle"
      label="Add Passkey"
      onPress={() => void addPasskey()}
    />
  );
}

export function SignOutRow() {
  const registerPushToken = useMutation(
    api.notifications.mutations.registerPushToken,
  );
  const unregisterPushToken = useMutation(
    api.notifications.mutations.unregisterPushToken,
  );

  async function signOut() {
    try {
      await unregisterCurrentPushToken(unregisterPushToken);
    } catch {
      Alert.alert(
        "Couldn't Sign Out",
        "Notifications are still on. Try again.",
      );
      return;
    }
    const result = await authClient.signOut();
    if (result.error) {
      await registerForNewMailNotifications(registerPushToken).catch(
        () => undefined,
      );
      Alert.alert("Couldn't Sign Out", result.error.message ?? "Try again.");
    }
  }

  function confirm() {
    Alert.alert("Sign Out of Rodge Mail?", undefined, [
      { style: "cancel", text: "Cancel" },
      { onPress: () => void signOut(), style: "destructive", text: "Sign Out" },
    ]);
  }

  return <ActionRow destructive label="Sign Out" onPress={confirm} />;
}
