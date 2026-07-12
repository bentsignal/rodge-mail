import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useMutation, useQuery } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { NotificationSetupState } from "./notification-setup";
import {
  createNotificationResponseResolver,
  MOBILE_THREAD_ROUTE,
} from "./notification-routing";
import {
  resolveNotificationSetupState,
  shouldRestoreNotificationRegistration,
} from "./notification-setup";

const installationIdKey = "rodge-mail.notification-installation-id";
const pushTokenKey = "rodge-mail.expo-push-token";
const setupStateListeners = new Set<() => void>();
let notificationSetupSnapshot: NotificationSetupState | undefined;
const resolveNotificationResponse = createNotificationResponseResolver();

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
  const accountPreferences = useQuery(
    api.notifications.queries.listAccountPreferences,
    isAuthenticated ? {} : "skip",
  );
  const router = useRouter();
  const registrationEnabled =
    preferences?.newMailEnabled === true ||
    accountPreferences?.some(
      (preference) => preference.effective.newMailEnabled,
    ) === true;

  // eslint-disable-next-line no-restricted-syntax -- Registration synchronizes native permission/token state with the signed-in owner.
  useEffect(() => {
    if (!isAuthenticated || !registrationEnabled) return;

    function restoreRegistration() {
      void getNotificationPermission().then((permission) => {
        if (
          !shouldRestoreNotificationRegistration({
            isDevice: Device.isDevice,
            permission,
            preferenceEnabled: registrationEnabled,
          })
        ) {
          return;
        }
        void registerForNewMailNotifications(registerPushToken, {
          requestPermission: false,
        }).catch(() => undefined);
      });
    }

    restoreRegistration();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") restoreRegistration();
    });
    return () => subscription.remove();
  }, [isAuthenticated, registerPushToken, registrationEnabled]);

  // eslint-disable-next-line no-restricted-syntax -- Notification response subscriptions bridge native lifecycle events into Expo Router.
  useEffect(() => {
    if (!isAuthenticated) return;
    function openResponse(response: Notifications.NotificationResponse) {
      const target = resolveNotificationResponse(
        response.notification.request.identifier,
        response.notification.request.content.data,
      );
      if (!target) return;
      router.push({
        pathname: MOBILE_THREAD_ROUTE,
        params: { id: target.threadId, messageId: target.messageId },
      });
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

export function useNotificationSetupState() {
  const setupState = useSyncExternalStore(
    subscribeNotificationSetup,
    getNotificationSetupSnapshot,
    getNotificationSetupSnapshot,
  );
  return { refresh: refreshNotificationSetupState, setupState };
}

export async function registerForNewMailNotifications(
  registerPushToken: (args: {
    deviceId: string;
    platform: "android" | "ios";
    token: string;
  }) => Promise<unknown>,
  options: { requestPermission?: boolean } = {},
) {
  const permissionGranted = await prepareNotificationPermissions(
    options.requestPermission ?? true,
  );
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
  void refreshNotificationSetupState();
  return { kind: "registered" as const, token: pushToken.data };
}

export async function unregisterCurrentPushToken(
  unregisterPushToken: (args: { token: string }) => Promise<unknown>,
) {
  const token = await SecureStore.getItemAsync(pushTokenKey);
  if (!token) return;
  await unregisterPushToken({ token });
  await SecureStore.deleteItemAsync(pushTokenKey);
  void refreshNotificationSetupState();
}

async function prepareNotificationPermissions(requestPermission = true) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("new-mail", {
      name: "New mail",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status === Notifications.PermissionStatus.GRANTED) return true;
  if (!requestPermission) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === Notifications.PermissionStatus.GRANTED;
}

export async function getNotificationSetupState() {
  const [permission, token] = await Promise.all([
    getNotificationPermission(),
    SecureStore.getItemAsync(pushTokenKey),
  ]);
  return resolveNotificationSetupState({
    hasStoredToken: token !== null,
    isDevice: Device.isDevice,
    permission,
  });
}

async function getNotificationPermission() {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status === Notifications.PermissionStatus.GRANTED) {
    return "granted" as const;
  }
  if (permission.status === Notifications.PermissionStatus.DENIED) {
    return "denied" as const;
  }
  return "undetermined" as const;
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
      data: { messageId, route: MOBILE_THREAD_ROUTE, threadId },
    },
    trigger: null,
  });
}

async function getInstallationId() {
  const existing = await SecureStore.getItemAsync(installationIdKey);
  if (existing) return existing;
  const installationId = Crypto.randomUUID();
  await SecureStore.setItemAsync(installationIdKey, installationId);
  return installationId;
}

function subscribeNotificationSetup(listener: () => void) {
  setupStateListeners.add(listener);
  void refreshNotificationSetupState();
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") void refreshNotificationSetupState();
  });
  return () => {
    setupStateListeners.delete(listener);
    subscription.remove();
  };
}

function getNotificationSetupSnapshot() {
  return notificationSetupSnapshot;
}

async function refreshNotificationSetupState() {
  const nextState = await getNotificationSetupState();
  if (notificationSetupSnapshot === nextState) return nextState;
  notificationSetupSnapshot = nextState;
  setupStateListeners.forEach((listener) => listener());
  return nextState;
}
