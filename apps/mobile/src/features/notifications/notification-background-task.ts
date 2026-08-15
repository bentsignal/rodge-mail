import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import {
  getMailNotificationAction,
  isSilentMailNotificationAction,
} from "./notification-actions";
import {
  getNotificationQuickActionRequest,
  performNotificationQuickAction,
} from "./notification-quick-action";

const notificationActionTask = "rodge-mail.notification-action";

if (!TaskManager.isTaskDefined(notificationActionTask)) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    notificationActionTask,
    async ({ data, error }) => {
      if (error || !isNotificationResponse(data)) {
        return Notifications.BackgroundNotificationTaskResult.NoData;
      }
      const action = getMailNotificationAction(data.actionIdentifier);
      if (!action || !isSilentMailNotificationAction(action)) {
        return Notifications.BackgroundNotificationTaskResult.NoData;
      }

      await Notifications.dismissNotificationAsync(
        data.notification.request.identifier,
      ).catch(() => undefined);
      const request = getNotificationQuickActionRequest(
        action,
        data.notification.request.content.data ?? {},
      );
      if (!request) {
        return Notifications.BackgroundNotificationTaskResult.Failed;
      }
      const performed = await performNotificationQuickAction(request).catch(
        () => false,
      );
      return performed
        ? Notifications.BackgroundNotificationTaskResult.NewData
        : Notifications.BackgroundNotificationTaskResult.Failed;
    },
  );
}

if (Platform.OS === "android") {
  void Notifications.registerTaskAsync(notificationActionTask).catch(
    () => undefined,
  );
}

function isNotificationResponse(
  data: Notifications.NotificationTaskPayload,
): data is Notifications.NotificationResponse {
  return "actionIdentifier" in data;
}
