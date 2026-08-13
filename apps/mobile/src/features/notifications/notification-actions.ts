export const NEW_MAIL_CATEGORY = "new-mail-actions";
export const NEW_MAIL_MAILING_LIST_CATEGORY = "new-mail-list-actions";

export const PIN_NOTIFICATION_ACTION = "pin";
export const MARK_READ_NOTIFICATION_ACTION = "mark-read";
export const DELETE_NOTIFICATION_ACTION = "delete";
export const UNSUBSCRIBE_NOTIFICATION_ACTION = "unsubscribe";

export type MailNotificationAction =
  | typeof PIN_NOTIFICATION_ACTION
  | typeof MARK_READ_NOTIFICATION_ACTION
  | typeof DELETE_NOTIFICATION_ACTION
  | typeof UNSUBSCRIBE_NOTIFICATION_ACTION;

export function getMailNotificationAction(actionIdentifier: string) {
  if (actionIdentifier === PIN_NOTIFICATION_ACTION) {
    return PIN_NOTIFICATION_ACTION;
  }
  if (actionIdentifier === MARK_READ_NOTIFICATION_ACTION) {
    return MARK_READ_NOTIFICATION_ACTION;
  }
  if (actionIdentifier === DELETE_NOTIFICATION_ACTION) {
    return DELETE_NOTIFICATION_ACTION;
  }
  if (actionIdentifier === UNSUBSCRIBE_NOTIFICATION_ACTION) {
    return UNSUBSCRIBE_NOTIFICATION_ACTION;
  }
  return undefined;
}
