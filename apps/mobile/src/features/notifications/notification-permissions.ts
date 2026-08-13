import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export async function prepareNotificationPermissions(requestPermission = true) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("new-mail", {
      name: "New mail",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (isNotificationPermissionGranted(current)) return true;
  if (!requestPermission) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return isNotificationPermissionGranted(requested);
}

export async function getNotificationPermission() {
  const permission = await Notifications.getPermissionsAsync();
  if (isNotificationPermissionGranted(permission)) return "granted" as const;
  if (isNotificationPermissionDenied(permission)) return "denied" as const;
  return "undetermined" as const;
}

function isNotificationPermissionGranted(
  permission: Notifications.NotificationPermissionsStatus,
) {
  if (Platform.OS !== "ios") {
    return permission.status === Notifications.PermissionStatus.GRANTED;
  }
  return (
    permission.ios?.status ===
      Notifications.IosAuthorizationStatus.AUTHORIZED ||
    permission.ios?.status ===
      Notifications.IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

function isNotificationPermissionDenied(
  permission: Notifications.NotificationPermissionsStatus,
) {
  if (Platform.OS !== "ios") {
    return permission.status === Notifications.PermissionStatus.DENIED;
  }
  return permission.ios?.status === Notifications.IosAuthorizationStatus.DENIED;
}
