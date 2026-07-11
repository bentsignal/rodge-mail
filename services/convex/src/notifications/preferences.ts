export interface NotificationPreferenceValues {
  includePreview: boolean;
  newMailEnabled: boolean;
}

export interface NotificationPreferenceOverride {
  includePreview?: boolean;
  newMailEnabled?: boolean;
}

export const defaultNotificationPreferences = {
  includePreview: true,
  newMailEnabled: false,
} satisfies NotificationPreferenceValues;

export function resolveNotificationPreferences(
  global: NotificationPreferenceValues | null | undefined,
  account: NotificationPreferenceOverride | null | undefined,
) {
  return {
    includePreview:
      account?.includePreview ??
      global?.includePreview ??
      defaultNotificationPreferences.includePreview,
    newMailEnabled:
      account?.newMailEnabled ??
      global?.newMailEnabled ??
      defaultNotificationPreferences.newMailEnabled,
  } satisfies NotificationPreferenceValues;
}
