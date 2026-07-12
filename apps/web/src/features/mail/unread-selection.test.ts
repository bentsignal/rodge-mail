import { describe, expect, it } from "vitest";

import { resolveUnreadSelection } from "./unread-selection";

const first = {
  _id: "message-1",
  threadId: "thread-1",
};

describe("unread selection", () => {
  it("moves to the first remaining unread thread when the reader disappears", () => {
    expect(
      resolveUnreadSelection({
        isLoading: false,
        isLoadingSelectedThread: false,
        messages: [first],
        selectedThreadIsUnread: false,
        selectedThreadId: "thread-read",
        unreadOnly: true,
      }),
    ).toEqual({ message: first, type: "select" });
  });

  it("clears the reader when no unread thread remains", () => {
    expect(
      resolveUnreadSelection({
        isLoading: false,
        isLoadingSelectedThread: false,
        messages: [],
        selectedThreadIsUnread: false,
        selectedThreadId: "thread-read",
        unreadOnly: true,
      }),
    ).toEqual({ type: "clear" });
  });

  it("does not reconcile while loading or outside unread scope", () => {
    expect(
      resolveUnreadSelection({
        isLoading: true,
        isLoadingSelectedThread: false,
        messages: [],
        selectedThreadIsUnread: false,
        selectedThreadId: "thread-read",
        unreadOnly: true,
      }),
    ).toEqual({ type: "preserve" });
    expect(
      resolveUnreadSelection({
        isLoading: false,
        isLoadingSelectedThread: false,
        messages: [],
        selectedThreadIsUnread: false,
        selectedThreadId: "thread-read",
        unreadOnly: false,
      }),
    ).toEqual({ type: "preserve" });
  });

  it("preserves an unread deep link outside the loaded page", () => {
    expect(
      resolveUnreadSelection({
        isLoading: false,
        isLoadingSelectedThread: false,
        messages: [first],
        selectedThreadId: "thread-deep-link",
        selectedThreadIsUnread: true,
        unreadOnly: true,
      }),
    ).toEqual({ type: "preserve" });
  });
});
