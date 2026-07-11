import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useMutation, useQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";

const installationIdKey = "rodge-mail:notification-installation-id";
const pushTokenKey = "rodge-mail:expo-push-token";
const threadRoute = "/(tabs)/(inbox)/thread/[id]";

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

export function useMobileNotifications(isAuthenticated: boolean) {
  const registerPushToken = useMutation(
    api.notifications.mutations.registerPushToken,
  );
  const preferences = useQuery(
    api.notifications.queries.getPreferences,
    isAuthenticated ? {} : "skip",
  );
  const router = useRouter();

  // eslint-disable-next-line no-restricted-syntax -- Registration synchronizes native permission/token state with the signed-in owner.
  useEffect(() => {
    if (!isAuthenticated || !preferences?.newMailEnabled) return;
    void registerForNewMailNotifications(registerPushToken).catch(
      () => undefined,
    );
  }, [isAuthenticated, preferences?.newMailEnabled, registerPushToken]);

  // eslint-disable-next-line no-restricted-syntax -- Notification response subscriptions bridge native lifecycle events into Expo Router.
  useEffect(() => {
    if (!isAuthenticated) return;
    function openResponse(response: Notifications.NotificationResponse) {
      const threadId = getNotificationThreadId(
        response.notification.request.content.data,
      );
      if (!threadId) return;
      router.push({ pathname: threadRoute, params: { id: threadId } });
    }
    const subscription =
      Notifications.addNotificationResponseReceivedListener(openResponse);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      openResponse(response);
      void Notifications.clearLastNotificationResponseAsync();
    });
    return () => subscription.remove();
  }, [isAuthenticated, router]);
}

export async function registerForNewMailNotifications(
  registerPushToken: (args: {
    deviceId: string;
    platform: "android" | "ios";
    token: string;
  }) => Promise<unknown>,
) {
  const permissionGranted = await prepareNotificationPermissions();
  if (!permissionGranted) {
    return { kind: "denied" as const };
  }
  if (!Device.isDevice) return { kind: "simulator" as const };

  const projectId = Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Expo project ID is unavailable");
  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  const deviceId = await getInstallationId();
  await registerPushToken({
    deviceId,
    platform: Platform.OS === "android" ? "android" : "ios",
    token: pushToken.data,
  });
  await SecureStore.setItemAsync(pushTokenKey, pushToken.data);
  return { kind: "registered" as const, token: pushToken.data };
}

export async function unregisterCurrentPushToken(
  unregisterPushToken: (args: { token: string }) => Promise<unknown>,
) {
  const token = await SecureStore.getItemAsync(pushTokenKey);
  if (!token) return;
  await unregisterPushToken({ token });
  await SecureStore.deleteItemAsync(pushTokenKey);
}

async function prepareNotificationPermissions() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("new-mail", {
      name: "New mail",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status === Notifications.PermissionStatus.GRANTED) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === Notifications.PermissionStatus.GRANTED;
}

export async function scheduleLocalNotificationPreview(
  threadId = "simulator-preview-thread",
  messageId = "simulator-preview-message",
) {
  const permissionGranted = await prepareNotificationPermissions();
  if (!permissionGranted) {
    throw new Error("Notification permission is required for the preview.");
  }
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: "Rodge Mail",
      body: "Simulator notification preview",
      sound: "default",
      data: { messageId, route: threadRoute, threadId },
    },
    trigger: null,
  });
}

function getNotificationThreadId(data: Record<string, unknown> | undefined) {
  if (data?.route !== threadRoute || typeof data.threadId !== "string") {
    return undefined;
  }
  return data.threadId;
}

async function getInstallationId() {
  const existing = await SecureStore.getItemAsync(installationIdKey);
  if (existing) return existing;
  const installationId = Crypto.randomUUID();
  await SecureStore.setItemAsync(installationIdKey, installationId);
  return installationId;
}
