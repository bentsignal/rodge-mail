interface NewMailMessage {
  _id: string;
  threadId: string;
  from: { address: string; name?: string };
  snippet: string;
  subject: string;
}

export const NEW_MAIL_CATEGORY = "new-mail-actions";
export const NEW_MAIL_MAILING_LIST_CATEGORY = "new-mail-list-actions";

export const MOBILE_THREAD_ROUTE = "/(tabs)/(inbox)/thread/[id]";

export function isExpoPushToken(token: string) {
  return /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/u.test(token);
}

export function buildNewMailPush(
  message: NewMailMessage,
  includePreview: boolean,
  unsubscribeAvailable = false,
) {
  const sender = firstNonempty(message.from.name, message.from.address);
  return {
    title: sender,
    body: includePreview
      ? firstNonempty(message.subject, message.snippet, "New message")
      : "New message",
    sound: "default" as const,
    categoryId: unsubscribeAvailable
      ? NEW_MAIL_MAILING_LIST_CATEGORY
      : NEW_MAIL_CATEGORY,
    data: {
      messageId: message._id,
      route: MOBILE_THREAD_ROUTE,
      threadId: message.threadId,
    },
  };
}

function firstNonempty(...values: (string | undefined)[]) {
  return values.find((value) => value?.trim()) ?? "";
}
