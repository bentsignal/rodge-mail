import { describe, expect, it } from "vitest";

import type { Doc } from "@rodge-mail/convex/model";

import { toConvexId } from "../lib/convex-id";
import { markCleanViewPending } from "./clean-view-optimistic";

const first = toConvexId<"messages">("m1");
const second = toConvexId<"messages">("m2");

const readyCleanView = {
  _creationTime: 1,
  _id: toConvexId<"messageCleanViews">("c1"),
  cleanedMarkdown: "Hello",
  createdAt: 1,
  inputHash: "hash",
  jobKey: "job",
  messageId: first,
  outputSchemaVersion: "v1",
  ownerId: "owner",
  promptVersion: "v1",
  status: "ready",
  updatedAt: 1,
} satisfies Doc<"messageCleanViews">;

function thread(cleanView: Doc<"messageCleanViews"> | null) {
  return {
    messages: [
      { _id: first, cleanView, ownerId: "owner" },
      { _id: second, cleanView: null, ownerId: "owner" },
    ],
  };
}

describe("markCleanViewPending", () => {
  it("marks an existing clean view pending and keeps its content", () => {
    const next = markCleanViewPending(thread(readyCleanView), first, 10);
    expect(next.messages[0]?.cleanView).toMatchObject({
      cleanedMarkdown: "Hello",
      status: "pending",
      updatedAt: 10,
    });
    expect(next.messages[1]?.cleanView).toBeNull();
  });

  it("creates a pending clean view for a message without one", () => {
    const next = markCleanViewPending(thread(null), first, 10);
    expect(next.messages[0]?.cleanView).toMatchObject({
      messageId: first,
      ownerId: "owner",
      status: "pending",
    });
  });

  it("leaves threads without the message alone", () => {
    const original = thread(null);
    expect(
      markCleanViewPending(original, toConvexId<"messages">("other"), 10),
    ).toBe(original);
  });
});
