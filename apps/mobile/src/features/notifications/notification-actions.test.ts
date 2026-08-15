import { describe, expect, it } from "vitest";

import {
  ARCHIVE_NOTIFICATION_ACTION,
  createMailNotificationAction,
  getMailNotificationAction,
  isSilentMailNotificationAction,
  MARK_READ_NOTIFICATION_ACTION,
  PIN_NOTIFICATION_ACTION,
  UNSUBSCRIBE_NOTIFICATION_ACTION,
} from "./notification-actions";

describe("mail notification actions", () => {
  it.each([
    [PIN_NOTIFICATION_ACTION, "Pin"],
    [MARK_READ_NOTIFICATION_ACTION, "Mark Read"],
    [ARCHIVE_NOTIFICATION_ACTION, "Archive"],
  ] as const)("keeps %s in the background", (identifier, buttonTitle) => {
    expect(
      createMailNotificationAction(identifier, buttonTitle, {
        opensAppToForeground: false,
      }),
    ).toEqual({
      identifier,
      buttonTitle,
      options: {
        isDestructive: false,
        opensAppToForeground: false,
      },
    });
  });

  it("allows interactive actions to open the app", () => {
    expect(
      createMailNotificationAction(
        UNSUBSCRIBE_NOTIFICATION_ACTION,
        "Unsubscribe",
        { isDestructive: true },
      ).options,
    ).toEqual({ isDestructive: true, opensAppToForeground: true });
  });

  it("accepts Rodge Mail action identifiers", () => {
    expect(getMailNotificationAction(PIN_NOTIFICATION_ACTION)).toBe("pin");
    expect(getMailNotificationAction(MARK_READ_NOTIFICATION_ACTION)).toBe(
      "mark-read",
    );
    expect(getMailNotificationAction(ARCHIVE_NOTIFICATION_ACTION)).toBe(
      "archive",
    );
    expect(getMailNotificationAction(UNSUBSCRIBE_NOTIFICATION_ACTION)).toBe(
      "unsubscribe",
    );
  });

  it("limits silent handling to the three self-contained actions", () => {
    expect(isSilentMailNotificationAction(PIN_NOTIFICATION_ACTION)).toBe(true);
    expect(isSilentMailNotificationAction(MARK_READ_NOTIFICATION_ACTION)).toBe(
      true,
    );
    expect(isSilentMailNotificationAction(ARCHIVE_NOTIFICATION_ACTION)).toBe(
      true,
    );
    expect(
      isSilentMailNotificationAction(UNSUBSCRIBE_NOTIFICATION_ACTION),
    ).toBe(false);
  });

  it("ignores default taps and unknown actions", () => {
    expect(
      getMailNotificationAction("expo.modules.notifications.actions.DEFAULT"),
    ).toBeUndefined();
    expect(getMailNotificationAction("reply")).toBeUndefined();
  });
});
