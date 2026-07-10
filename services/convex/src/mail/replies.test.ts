/* eslint-disable @typescript-eslint/consistent-type-assertions -- Tests use representative branded Convex IDs. */
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import type { Id } from "../_generated/dataModel";
import { resolveReplyMetadata } from "./replies";

const accountId = "account-1" as Id<"mailAccounts">;
const message = {
  _id: "message-1" as Id<"messages">,
  accountId,
  internetMessageId: "<internet-message-1@example.com>",
  ownerId: "owner-1",
  remoteMessageId: "remote-message-1",
};

describe("reply metadata", () => {
  it("derives provider identifiers from the owned source message", () => {
    expect(resolveReplyMetadata(message, "owner-1", accountId)).toEqual({
      replyToInternetMessageId: "<internet-message-1@example.com>",
      replyToMessageId: message._id,
      replyToRemoteMessageId: "remote-message-1",
    });
  });

  it("rejects a source message from another account", () => {
    expect(() =>
      resolveReplyMetadata(
        message,
        "owner-1",
        "account-2" as Id<"mailAccounts">,
      ),
    ).toThrowError(
      new ConvexError("Reply message must belong to the sending account"),
    );
  });

  it("rejects a source message owned by another user", () => {
    expect(() =>
      resolveReplyMetadata(message, "owner-2", accountId),
    ).toThrowError(new ConvexError("Message not found"));
  });
});
