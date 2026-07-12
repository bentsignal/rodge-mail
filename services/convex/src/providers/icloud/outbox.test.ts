/* eslint-disable @typescript-eslint/consistent-type-assertions -- Tests use a representative branded Convex ID. */
import { describe, expect, it } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { getICloudConnectionArgs, getICloudReadRetryArgs } from "./outbox";

const accountId = "account-1" as Id<"mailAccounts">;
const update = {
  ownerId: "owner-1",
  accountId,
  remoteMessageId: "INBOX:42:7",
  isRead: true,
};

describe("iCloud read-state updates", () => {
  it.each([undefined, 1])(
    "passes only connection validator fields on attempt %s",
    (attempt) => {
      const actionArgs = { ...update, attempt };

      expect(getICloudConnectionArgs(actionArgs)).toEqual({
        ownerId: "owner-1",
        accountId,
      });
    },
  );

  it.each([true, false])(
    "keeps retries converging on the requested isRead=%s state",
    (isRead) => {
      const retry = getICloudReadRetryArgs({ ...update, isRead }, 2);

      expect(retry).toEqual({
        ownerId: "owner-1",
        accountId,
        remoteMessageId: "INBOX:42:7",
        isRead,
        attempt: 2,
      });
      expect(getICloudConnectionArgs(retry)).toEqual({
        ownerId: "owner-1",
        accountId,
      });
    },
  );

  it("rebuilds retry arguments instead of forwarding unknown fields", () => {
    const actionArgs = {
      ...update,
      unexpected: "must not cross a validator boundary",
    };
    const retry = getICloudReadRetryArgs(actionArgs, 1);

    expect(retry).not.toHaveProperty("unexpected");
  });
});
