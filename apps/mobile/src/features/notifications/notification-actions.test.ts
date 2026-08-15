import { describe, expect, it } from "vitest";

import {
  createMailNotificationAction,
  DELETE_NOTIFICATION_ACTION,
  getMailNotificationAction,
  MARK_READ_NOTIFICATION_ACTION,
  PIN_NOTIFICATION_ACTION,
  UNSUBSCRIBE_NOTIFICATION_ACTION,
} from "./notification-actions";

describe("mail notification actions", () => {
  it("keeps quick actions in the background", () => {
    expect(
      createMailNotificationAction(PIN_NOTIFICATION_ACTION, "Pin"),
    ).toEqual({
      identifier: "pin",
      buttonTitle: "Pin",
      options: {
        isDestructive: false,
        opensAppToForeground: false,
      },
    });
    expect(
      createMailNotificationAction(DELETE_NOTIFICATION_ACTION, "Delete", true)
        .options,
    ).toEqual({ isDestructive: true, opensAppToForeground: false });
  });

  it("accepts Rodge Mail action identifiers", () => {
    expect(getMailNotificationAction(PIN_NOTIFICATION_ACTION)).toBe("pin");
    expect(getMailNotificationAction(MARK_READ_NOTIFICATION_ACTION)).toBe(
      "mark-read",
    );
    expect(getMailNotificationAction(UNSUBSCRIBE_NOTIFICATION_ACTION)).toBe(
      "unsubscribe",
    );
  });

  it("ignores default taps and unknown actions", () => {
    expect(
      getMailNotificationAction("expo.modules.notifications.actions.DEFAULT"),
    ).toBeUndefined();
    expect(getMailNotificationAction("reply")).toBeUndefined();
  });
});
