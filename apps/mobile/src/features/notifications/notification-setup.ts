export type NotificationSetupState =
  | "permission-denied"
  | "ready"
  | "setup-required"
  | "unsupported";

export function resolveNotificationSetupState(args: {
  hasStoredToken: boolean;
  isDevice: boolean;
  permission: "denied" | "granted" | "undetermined";
}) {
  if (!args.isDevice) return "unsupported";
  if (args.permission === "denied") return "permission-denied";
  if (args.permission !== "granted" || !args.hasStoredToken) {
    return "setup-required";
  }
  return "ready";
}

export function isNotificationDeliveryEnabled(
  preferenceEnabled: boolean,
  setupState: NotificationSetupState,
) {
  return preferenceEnabled && setupState === "ready";
}

export function shouldRestoreNotificationRegistration(args: {
  isDevice: boolean;
  permission: "denied" | "granted" | "undetermined";
  preferenceEnabled: boolean;
}) {
  return (
    args.isDevice && args.permission === "granted" && args.preferenceEnabled
  );
}
