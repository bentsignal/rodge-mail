import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useAction, useMutation } from "convex/react";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import type { MailNotificationAction } from "./notification-actions";
import { toConvexId } from "../mail/lib/convex-id";
import {
  createMailNotificationAction,
  DELETE_NOTIFICATION_ACTION,
  getMailNotificationAction,
  MARK_READ_NOTIFICATION_ACTION,
  NEW_MAIL_CATEGORY,
  NEW_MAIL_MAILING_LIST_CATEGORY,
  PIN_NOTIFICATION_ACTION,
  UNSUBSCRIBE_NOTIFICATION_ACTION,
} from "./notification-actions";
import {
  createNotificationResponseResolver,
  MOBILE_THREAD_ROUTE,
} from "./notification-routing";

const resolveNotificationResponse = createNotificationResponseResolver();

export function useNotificationActions(isAuthenticated: boolean) {
  const setThreadPinned = useMutation(api.mail.mutations.setThreadPinned);
  const setThreadRead = useMutation(api.mail.mutations.setThreadRead);
  const removeThreadFromRodge = useMutation(
    api.mail.mutations.removeThreadFromRodge,
  );
  const unsubscribe = useAction(api.mailingLists.actions.unsubscribe);
  const router = useRouter();

  // eslint-disable-next-line no-restricted-syntax -- Native categories must exist before iOS presents remote notification actions.
  useEffect(() => {
    void registerMailNotificationCategories().catch(() => undefined);
  }, []);

  // eslint-disable-next-line no-restricted-syntax -- Native notification responses bridge into authenticated mail operations and Expo Router.
  useEffect(() => {
    if (!isAuthenticated) return;
    async function handleResponse(
      response: Notifications.NotificationResponse,
    ) {
      const action = getMailNotificationAction(response.actionIdentifier);
      if (!isSupportedResponse(response.actionIdentifier, action)) return;
      const target = resolveNotificationResponse(
        response.notification.request.identifier,
        response.notification.request.content.data,
      );
      if (!target) return;
      if (!action) {
        router.push({
          pathname: MOBILE_THREAD_ROUTE,
          params: { id: target.threadId, messageId: target.messageId },
        });
        return;
      }
      await executeMailNotificationAction(action, target, {
        removeThreadFromRodge,
        setThreadPinned,
        setThreadRead,
        unsubscribe,
      });
      await Notifications.dismissNotificationAsync(
        response.notification.request.identifier,
      );
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleResponse(response).catch(() => undefined);
      },
    );
    void handleLastNotificationResponse(handleResponse).catch(() => undefined);
    return () => subscription.remove();
  }, [
    isAuthenticated,
    removeThreadFromRodge,
    router,
    setThreadPinned,
    setThreadRead,
    unsubscribe,
  ]);
}

function isSupportedResponse(
  actionIdentifier: string,
  action: MailNotificationAction | undefined,
) {
  return (
    action !== undefined ||
    actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
  );
}

async function handleLastNotificationResponse(
  handleResponse: (
    response: Notifications.NotificationResponse,
  ) => Promise<void>,
) {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;
  await handleResponse(response).catch(() => undefined);
  await Notifications.clearLastNotificationResponseAsync();
}

async function registerMailNotificationCategories() {
  const commonActions = [
    createMailNotificationAction(PIN_NOTIFICATION_ACTION, "Pin"),
    createMailNotificationAction(MARK_READ_NOTIFICATION_ACTION, "Mark Read"),
    createMailNotificationAction(DELETE_NOTIFICATION_ACTION, "Delete", true),
  ];
  await Promise.all([
    Notifications.setNotificationCategoryAsync(
      NEW_MAIL_CATEGORY,
      commonActions,
    ),
    Notifications.setNotificationCategoryAsync(NEW_MAIL_MAILING_LIST_CATEGORY, [
      ...commonActions,
      createMailNotificationAction(
        UNSUBSCRIBE_NOTIFICATION_ACTION,
        "Unsubscribe",
        true,
      ),
    ]),
  ]);
}

async function executeMailNotificationAction(
  action: MailNotificationAction,
  target: { messageId: string; threadId: string },
  handlers: {
    removeThreadFromRodge: (args: {
      threadId: Id<"threads">;
    }) => Promise<unknown>;
    setThreadPinned: (args: {
      isPinned: boolean;
      threadId: Id<"threads">;
    }) => Promise<unknown>;
    setThreadRead: (args: {
      isRead: boolean;
      threadId: Id<"threads">;
    }) => Promise<unknown>;
    unsubscribe: (args: { messageId: Id<"messages"> }) => Promise<unknown>;
  },
) {
  const threadId = toConvexId<"threads">(target.threadId);
  if (action === PIN_NOTIFICATION_ACTION) {
    await handlers.setThreadPinned({ threadId, isPinned: true });
    return;
  }
  if (action === MARK_READ_NOTIFICATION_ACTION) {
    await handlers.setThreadRead({ threadId, isRead: true });
    return;
  }
  if (action === DELETE_NOTIFICATION_ACTION) {
    await handlers.removeThreadFromRodge({ threadId });
    return;
  }
  await handlers.unsubscribe({
    messageId: toConvexId<"messages">(target.messageId),
  });
}
