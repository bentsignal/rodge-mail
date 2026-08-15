export const NEW_MAIL_CATEGORY = "newMailActions";
export const NEW_MAIL_MAILING_LIST_CATEGORY = "newMailListActions";

export const PIN_NOTIFICATION_ACTION = "pin";
export const MARK_READ_NOTIFICATION_ACTION = "mark-read";
export const ARCHIVE_NOTIFICATION_ACTION = "archive";
export const UNSUBSCRIBE_NOTIFICATION_ACTION = "unsubscribe";

export type MailNotificationAction =
  | typeof PIN_NOTIFICATION_ACTION
  | typeof MARK_READ_NOTIFICATION_ACTION
  | typeof ARCHIVE_NOTIFICATION_ACTION
  | typeof UNSUBSCRIBE_NOTIFICATION_ACTION;

export type SilentMailNotificationAction =
  | typeof PIN_NOTIFICATION_ACTION
  | typeof MARK_READ_NOTIFICATION_ACTION
  | typeof ARCHIVE_NOTIFICATION_ACTION;

export function createMailNotificationAction(
  identifier: MailNotificationAction,
  buttonTitle: string,
  options: {
    isDestructive?: boolean;
    opensAppToForeground?: boolean;
  } = {},
) {
  return {
    identifier,
    buttonTitle,
    options: {
      isDestructive: options.isDestructive ?? false,
      opensAppToForeground: options.opensAppToForeground ?? true,
    },
  };
}

export function isSilentMailNotificationAction(
  action: MailNotificationAction,
): action is SilentMailNotificationAction {
  return (
    action === PIN_NOTIFICATION_ACTION ||
    action === MARK_READ_NOTIFICATION_ACTION ||
    action === ARCHIVE_NOTIFICATION_ACTION
  );
}

export function getMailNotificationAction(actionIdentifier: string) {
  if (actionIdentifier === PIN_NOTIFICATION_ACTION) {
    return PIN_NOTIFICATION_ACTION;
  }
  if (actionIdentifier === MARK_READ_NOTIFICATION_ACTION) {
    return MARK_READ_NOTIFICATION_ACTION;
  }
  if (actionIdentifier === ARCHIVE_NOTIFICATION_ACTION) {
    return ARCHIVE_NOTIFICATION_ACTION;
  }
  if (actionIdentifier === UNSUBSCRIBE_NOTIFICATION_ACTION) {
    return UNSUBSCRIBE_NOTIFICATION_ACTION;
  }
  return undefined;
}
