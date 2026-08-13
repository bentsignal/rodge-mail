import { describe, expect, it } from "vitest";

import {
  getMailNotificationAction,
  MARK_READ_NOTIFICATION_ACTION,
  PIN_NOTIFICATION_ACTION,
  UNSUBSCRIBE_NOTIFICATION_ACTION,
} from "./notification-actions";

describe("mail notification actions", () => {
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
